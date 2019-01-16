
/*
 /Users/tocoleman/src/www/users/tocoleman/extensions/chrome/search_deeplink/hsr_embed_flat.js
 upload to google drive
 share for anyone to find and read
 get link to share

 https:/ /drive.google.com/file/d/0B9jGtQ6OVJ67M3o0RHBWWFJuVkE/view?usp=sharing

 then make the shorter version with "host"

 https:/ /googledrive.com/host/0B9jGtQ6OVJ67M3o0RHBWWFJuVkE
 */

var are_we_logging_to_console = localStorage.hasOwnProperty('are_we_logging_to_console');
function console_log(msg) {
    if (are_we_logging_to_console) {
        console.log(msg);
    }
}

var are_we_blocking_logging_to_error_console = !localStorage.hasOwnProperty('are_we_blocking_logging_to_error_console');
function console_error(msg) {
    if (!are_we_blocking_logging_to_error_console) {
        console.error(msg);
    }
}

console_log('registering to inject json');
/* note: if doing local extension development, the id will be different.*/
/* put a breakpoint here, or temp change the code.*/
/* var injectJson_extensionId = 'mgehnlaglddmpglkknifnhkplpfehckk'; /* hsr deeplink */
/* injectJson_extensionId = 'efnpkekiifhnffjdegfnkhckikmablih'; /* deeplink development, set to your local id. */

var override_extension_id_for_testing = '';

var extension_id_insertion_point = document.createElement('span');
function injectJson_is_connection_needed(){
    var marker_id = 'json_injection_done_marker_id';
    var done_marker_element = document.getElementById(marker_id);
    if (done_marker_element) {
        return false;
    }
    var floater_star = document.createElement('span');
    floater_star.id = marker_id;
    floater_star.innerHTML = '*';
    floater_star.style.position = "fixed";
    floater_star.style.left = '3px';
    floater_star.style.top = '200px';
    floater_star.style.fontSize = '100px';
    floater_star.style.background = 'white';
    floater_star.style.borderRadius = '30px';
    floater_star.style.zIndex = '999999';
    floater_star.style.height = '110px';
    floater_star.style.width = '72px';
    floater_star.style.textAlign = 'center';
    floater_star.style.opacity = '0.3';

    floater_star.addEventListener('mouseover', function(){ floater_star.style.opacity = '0.9'});
    floater_star.addEventListener('mouseout', function(){ floater_star.style.opacity = '0.3'});

    floater_star.title = 'Json Injection\nThis floating star shows this page is connected.';
    document.getElementsByTagName('body')[0].appendChild(floater_star);

    extension_id_insertion_point.id = 'extension_id_insertion_point';
    floater_star.appendChild(extension_id_insertion_point);

    return true;
}

function injectJson_parse_out_multiple_requests(data) {

    if (!data.hasOwnProperty('requests')) {
        return;
    }

    for (var req_index = 0 ; req_index <  data.requests.length ; req_index++) {
        var request = data.requests[req_index];

        var next_data_to_inject = {};
        for (var child in request) {
            if (child == 'inject_json' && typeof request[child] == "string") {
                // todo: make this more generic
                var pull_parent_property = /parent\.(.*)/.exec(request[child]);
                if (pull_parent_property) {
                    var parent_property_name = pull_parent_property[1];
                    next_data_to_inject[child] = data[parent_property_name];
                    continue;
                }
            }
            next_data_to_inject[child] = request[child];
        }
        // todo: refactor out the working code to be separate from the function called by extension.
        injectJson_callback_from_extension(next_data_to_inject);
    }
}

function injectJson_callback_from_extension(data) {

    if (!data) return; /* disabled extensions still send requests */

    console_log('**********  inject json called with data: ' + data);

    if (data.hasOwnProperty('requests')) {
        injectJson_parse_out_multiple_requests(data);
        return;
    }

    if (data.hasOwnProperty('inject_json')) {
        /*
         :::: data.inject_json
         modify a single global object contained in
         the item to modify may have many values, data.inject_json may have some of them.
         :::: data.method_to_call
         the modified global object is then passed into data.method_to_call
         :::: data.require_name
         if the method to call is part of a require module, then the method is called within a require.
         */

        var objToModify = data.inject_json;

        if (data.obj_name_to_modify) {
            objToModify = window;
            var obj_to_modify_key_names = data.obj_name_to_modify.split('.');

            for (var i = 0; i < obj_to_modify_key_names.length; i++) {
                var next_key = obj_to_modify_key_names[i];
                if (!objToModify.hasOwnProperty(next_key)) {
                    console_error('cannot inject json data into object ' + data.obj_name_to_modify);
                    return;
                }
                objToModify = objToModify[next_key];
            }
            for (var objName in data.inject_json) {
                objToModify[objName] = data.inject_json[objName];
            }
        }

        // secret require name to make multiple calls.
        // default to this if the require name is presenter
        //if (data.require_name && data.require_name == '_populate_present_') {
        if (data.require_name && data.require_name == 'presenter' && !data.only_presenter) {
            // code copied from ajax response for HSR

            require(['presenter', 'modelPopulator', 'modelPopulatorAdditional'],
                function (presenter, modelPopulator, modelPopulatorAdditional) {
                    // model data was set previously as the injected json
                    // window.pageModel = data;
                    // prod code pulls hash from url, json injector must set this manually.
                    // window.pageModel.request = utils.queryToObject(utils.getHash());

                    modelPopulator.populate(window.pageModel);
                    modelPopulatorAdditional.populate(window.pageModel);

                    presenter.render(window.pageModel);

                    //if (data && data.metaData && data.metaData.isRetryRequest) {
                    //    formController.updateHashFromForm('#searchForm');
                    //}
                });
        } else {
            if (data.require_name) {
                require(data.require_name, function (required_module) {
                    console_log('inject json debug *** inside of require ' + data.require_name);
                    var module_method = required_module[data.method_to_call];
                    console_log('inject json debug *** inside of require method call ' + data.method_to_call);
                    // use "call" to specify the "this" parameter within the method being called.
                    module_method.call(required_module, objToModify);
                    console_log('inject json debug *** done with require ' + data.require_name);
                });
            } else {
                console_log('inject json debug *** inside of global function call ' + data.method_to_call);
                var global_method = find_function_from_text(data.method_to_call);
                global_method(objToModify);
                console_log('inject json debug *** done with global function call ' + data.method_to_call);
            }
        }
    }

    if (data.hasOwnProperty('pull_json')) {
        console_log('json injector received request to pull json data: ' + data.pull_json);
        store_request(data);
    }
    /*
    // todo: add own method if needed, otherwise use inject_json with no require or data to inject.
    if (data.hasOwnProperty('call_function')) {
        console_log('json injector received request to call function: ' + data.method_to_call);
        if (data.require_name) {
            console_log('json injector calling function within module: ' + data.require_name);
            require( data.require_name, function( required_module ){
                console_log('inject json debug *** inside of require ' + data.require_name);
                var module_method = required_module[data.method_to_call];
                module_method();
                console_log('inject json debug *** done with require ' + data.require_name);
            });
        } else {
            var vanilla_method = window[data.method_to_call];
            vanilla_method();
        }
    }
    */
}

function find_function_from_text(text) {
    var scope = 0;
    if (text.indexOf('.') < 0) {
        // no namespace, no clue, just try returning a global function.
        scope = window[text];
    } else {
        var scope_nodes = text.split('.');
        var first_node = scope_nodes.shift();
        if (first_node == 'infosite') {
            scope = infosite;
        } else if (first_nodes == 'hotel_search') {
            scope = hotelSearch;
        } else if (first_nodes == 'pageModel') {
            scope = pageModel;
        }
        while (scope_nodes && scope_nodes.length && scope_nodes.length > 0) {
            var next_node = scope_nodes.shift();
            scope = scope[next_node];
        }
    }
    return scope;
}

var requested_data_item_cache = [];
function store_request(data) {
    requested_data_item_cache.push(data);
    var max_cleanup = 30;
    while (max_cleanup-- > 0 && requested_data_item_cache.length > 20) {
        requested_data_item_cache.shift();
    }
}
function get_request() {
    var return_value = {};
    if (requested_data_item_cache.length > 0) {
        return_value = requested_data_item_cache.shift();
    }
    return return_value;
}
/* extension must have backend, to store callback even when ui not visible. */
/* callback method stored only for short time, so we must resend over and over. */

// iterate through the object
// cut off at given depth
var pull_json_safe_stringify = function(result, obj, depth, msg) {
    if (!msg) {
        debugger;
        console.log('enter safe strigify');
    }
    if (typeof(result) !== 'object') return;
    if (depth > 0) {
        var need_call = false;
        for (var key in obj) {
            if (key === 'price') {
                var stop = 1;
                // debugger;
            }
            if (key === 'offers') {
                var stop = 1;
                // debugger;
            }
            if (key === 'rooms') {
                var stop = 1;
                // debugger;
            }
            if (key === 'ownerDocument') continue;
            if (key === 'context') continue;
            if (obj[key] == null) {
                result[key] = null;
            } else if (obj[key].constructor === Array) {
                result[key] = [];
                need_call = true;
            } else if (obj[key].constructor === Object) {
                result[key] = {};
                need_call = true;
            } else if (typeof(obj[key]) === 'object') {
                result[key] = {};
                need_call = true;
            } else if (typeof(obj[key]) === 'string') {
                result[key] = obj[key];
            } else if (typeof(obj[key]) === 'number') {
                result[key] = obj[key];
            } else if (typeof(obj[key]) === 'boolean') {
                result[key] = obj[key];
            } else if (typeof(obj[key]) === 'function') {
                // do not copy functions
            } else {
                console.log('type of ' + key + ' = ' + typeof(obj[key]));
                // result[key] = obj[key];
            }
            if (need_call) {
                try {
                    pull_json_safe_stringify(result[key], obj[key], depth - 1, 'a');
                } catch(e) {
                    // console.log('error with key: ' + key);
                    // debugger;
                    var stop = 1;
                }
            }
        }
        return;
    }
    for (var keyCut in result) {
        if(typeof(result[keyCut]) === 'object') {
            result[keyCut] = {};
        }
    }
};

function injectJson_setup_connection_with_extension() {
    var hsr_embed_interval_id = setInterval(function () {
        var data_for_extension = {state: 'ready_to_inject'};
        var choices = '';
        var requested_data_item = get_request();
        if (requested_data_item.pull_json && requested_data_item.pull_json.indexOf('choices') > -1) {
            var obj_name = requested_data_item.obj_name;
            var original_request = requested_data_item;

            var object_to_parse = window;
            var require_name = requested_data_item.require_name;
            if (require_name) {
                var message = 'failed_to_require_module________' + requested_data_item.require_name;
                object_to_parse = {};
                object_to_parse[message] = message;

                require(requested_data_item.require_name, function (m) {
                    object_to_parse = m;
                });
            //} else if (!object_to_parse.hasOwnProperty(obj_name_construction[0])) {
            } else if (!object_to_parse.hasOwnProperty(obj_name)) {
                require(obj_name_construction[0], function (m) {
                    // todo: do this in a way that does not pollute the global namespace.
                    object_to_parse[obj_name_construction[0]] = m;
                });
            }
            var obj_name_construction = obj_name.split('.');
            for (var i = 0; i < obj_name_construction.length; i++) {
                if ('choices' === obj_name_construction[i]) {
                    break;
                }
                if (!object_to_parse.hasOwnProperty(obj_name_construction[i])) {
                    console_error('cannot retrieve choices of data for ' + obj_name);
                    continue; // keep trying
                }
                object_to_parse = object_to_parse[obj_name_construction[i]];
            }

            var delimiter = '';
            for (var children in object_to_parse) {
                choices += delimiter + children;
                delimiter = ',';
            }
            data_for_extension.choices = {};
            var max_depth_of_copy = 7;
            if (requested_data_item.depth) {
               max_depth_of_copy = requested_data_item.depth;
            }
            pull_json_safe_stringify(data_for_extension.choices, choices, max_depth_of_copy);
            data_for_extension.original_request = original_request;
        } else if (requested_data_item.pull_json) {
            /* debugger; */
            var obj_name = requested_data_item.obj_name;
            var value_name = requested_data_item.pull_json;
            if (value_name == 'results' && !requested_data_item.only_results) {
                value_name = '*';
            }
            var pull_all_values = false;
            if (value_name == '*') {
                pull_all_values = true;
            }
            var original_request = requested_data_item;
            var object_to_return = window;
            var result_builder = {};
            var requested_json = result_builder;
            if (obj_name) {
                // if the object is not found, try requiring it.
                if (object_to_return.hasOwnProperty(obj_name)) {
                    object_to_return = object_to_return[obj_name];
                } else {
                    object_to_return = require(obj_name);
                    if (typeof(object_to_return) == 'undefined') {
                        console.error('failed to require: ' + obj_name);
                    }
                }
            }

            // outer loop is comma delimited items to extract
            var parent_obj_source = object_to_return;
            var parent_obj_target = result_builder;
            var val_name_list = [];
            if (pull_all_values) {
                for (var key_name_in_source in parent_obj_source) {
                    val_name_list.push(key_name_in_source);
                }
            } else {
                val_name_list = value_name.split(/[,\s]+/);
            }
            for (var val_i = 0 ; val_i < val_name_list.length ; val_i++) {

                // inner loop is nested values
                obj_name_construction = val_name_list[val_i].split('.');
                var source_walker = parent_obj_source;
                var target_builder = parent_obj_target;
                for (var i = 0; i < obj_name_construction.length; i++) {
                    // flights page has item "model" but it returns false for "hasOwnProperty"
                    // todo: how else can we check for it?
                    if (!source_walker.hasOwnProperty(obj_name_construction[i]) && !source_walker[obj_name_construction[i]]) {
                        console_error('failed to find sub item: ' + obj_name_construction[i]);
                        continue;
                    }
                    if (i === obj_name_construction.length - 1) {
                        // copy in the value.
                        target_builder[obj_name_construction[i]] = source_walker[obj_name_construction[i]];
                    } else {
                        // go deeper into the source value
                        source_walker = source_walker[obj_name_construction[i]];
                        // construct the return value data structure
                        target_builder[obj_name_construction[i]] = {};
                        target_builder = target_builder[obj_name_construction[i]];
                    }
                }
            }
            data_for_extension.requested_json = {};
            pull_json_safe_stringify(data_for_extension.requested_json, requested_json, 7);
            data_for_extension.original_request = original_request;
        }
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            var extension_id_elements = extension_id_insertion_point.children;
            for (var i = 0; i < extension_id_elements.length; i++) {
                var extension_id = extension_id_elements[i].id;
                if (!extension_id) {
                    continue;
                }
                if (data_for_extension && data_for_extension.original_request && data_for_extension.original_request.extension_id != extension_id) {
                    /* if the original request has an extension id, only send data back to that extension. */
                    /* console_log('original request does not match extension id of element: ' + extension_id); */
                    continue;
                }
                chrome.runtime.sendMessage(extension_id, data_for_extension, injectJson_callback_from_extension);
            }
            if (override_extension_id_for_testing) {
                chrome.runtime.sendMessage(override_extension_id_for_testing, data_for_extension, injectJson_callback_from_extension);
            }
        } else {
            console_log('unable to talk with chrome, turn off timer');
            clearInterval(hsr_embed_interval_id);
        }
    }, 2000);
}
if (injectJson_is_connection_needed()) {
    injectJson_setup_connection_with_extension();
}
console_log('registering to inject json : done');

