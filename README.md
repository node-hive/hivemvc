hive-mvc
=======

The next evolution of nuby-express; an advanced, RAD environment for Express sites.

Nuby Express has proven successful at managing large projects; however it did not load
(not respond, load) fast enough for Nodejitsu and it had issues with require pathing.

HiveMVC is going to address some of the failings of NE and provide additional functionality:

* The ability to attach itself to an existing Express.js project
* The ability to launch and add actions to a running project
* Better ability to respond at any point in the loading process
* The ability to mock data sets and cache results for "de facto" unit tests
* Abstracting responses from HTTP to model expert / non-http systems
* The ability to "hot swap" patches to a working system.
* A complete data backup and import system to enable transport of data between local and remote systems.
* A simpler hierarchy of containers above the Action level
* A reconsideration of static serving to bind static directories to specific components, allowing for functional filtering of static data
* A callback-centric pipeline inside actions.

This on top of the existing feature set of Nuby Express

* Highly configurable convention based routing and configuration of actions
* A very action-centric system of web application design
* Support for local static file hosting at each action
* Strong system of layouts with local hosting of layout static files
* Designed for a large and growing single page(s) application
* A strong family of helper libraries for your custom application

Basic Architectural Concepts
============================

Hive-mvc is built using the follwoing foundational modules:

1) **hive-configuration** - a system for laoding configuration from JSON files or modules.
2) **Hive-component** - a framework for building up a class factory based on configuration and method definitions. Designed  to allow for multiple inputs for both to be mixed into the final definition.
3) **Hive-model** - A bare-bones "in memory" registry of key/values, used to track apiary resources.
4) **Hive-loader** - to bootstrap the application from the file system Hive-loader scans the frames in your application
   into your running application ('apiary').

Hive attempts to keep its sturcture as diffuse as possible and in fact each of these systems can be used independantly. But the magic happens when they are mixed in hive-mvc to respond to and define and manage rich web applications. 

Hive is "action centric" - all power is given to the action; you could even hypothetically run an entire site off a
single action.

The full genus is

`APIARY : FRAME : HIVE : ACTION`

which maps to classical MVC as 

`[framework] : [module] : [controller] [controller method(s)]`

Actions
-------

Actions are designed to respond to one OR MORE url endpoints; and so, a single action can respond to an entire REST
system. They can serve their own static files as well.

Action configurations must have one or more entries in the routes object as in

<code>
{
   "response": {
   	"get": ["/foo/bar", "foo/bar/:id/", "foo/bar/:id/:element"],
   	"post": "/foo/bar/:id"
   }
}

</code>

Actions' code is made up of a series of handlers, defined in a `[action_name]_actions.js` code file:

``` javasccript

module.exports = {

// enforce any access limitations; route unauthrozied users or requests with bad sigtnatures elseware
   on_validate(context, done){ ... },
// append data from models, file systems, etc. to the context based on request parameters
   on_input(context, done){ ... },
// output any data to file systems, modeels, etc., or otherwise reconcile the request input with data pulled in during the input phase
   on_process(context, done){ ... },
// post-process data in a form that the view templates/rest API desires. 
   on_output(context, done){ ... }

```

There are "hooks" for managing specific stages of a response. The reason they are so numerous is to reduce as much as possible the risk of callback spaghetti. 

You don't have to hand code overrides for every one (or ANY) of these methods -- for instance, if you have no need for security on a response, you can skip the `on_validate` hook.

each of these methods have the following signatures:

<code>
on_[method](ctx, callback) {
	....

	callback();
}

These callbacks are managed by async.waterfall and shouldn't be called directly.

Context
-------

The context object has a lot of local properties:

* $apiary
* $req and $res, express objects

and one public property
* out, a hive-collection

but by design, other than out, the context should be easily mockable and these properties ignored unless needed.

Hives
-----

Hives are groups of actions -- as in "a hive of activity". They can have specific resources to augment their
functionality.

Frames
------

Frames are groups of hives. A frame should be as self-sufficient as possible in delivering functionality - you should
be able to pull a frame off a git repo and run it as is.

Apiary
------

An apiary is the "world" of a hive-mvc app. It contains the server and app from express, all the resources, actions,
and hives, and a dataspace for all the models. The apiary is injected into all the loaders and handlers of the
bootstrapping process as well as the configurations of the actions, hives and frames. It is exposed to the resource
factories as well.

The apiary is intended to serve as a global space for the web application where needed. It is what allows you to load
a resource or model from one part of your web application and have it available wherever you need it.

Resources
=========

Resources are a vague concept, by design. They have the same application space as a node module,
but unlike node modules they are registered by name in a global object space (apiary.Resource.list model) and are
typed.

Depending on the resources type, they are injected as different points in the lifecycle of the application.

* mixins are executed once, at startup. They must have a resopnd(cb) method.
* view_helpers are executed between the end of an action and the view rendering of the template.
* models are instantiated and added to the apiary dataspace. note that there is no requirement for a model resource to
  be an instance of hive-model - the only requirement of a model is that it have a unique name property.
* generic resources are called and executed manually, where needed.

resource files are required and registered in the Resource.list model as is, so any node file that exports a function
with the following signature

<code>
module.exports = function(apiary, cb){
	var dataspace = apiary.dataspace;
	....
	cb(null, myResource);
}
</code>
with a name is a legitimate resource. Given that the apiary itself can be configured with database identity/security
et.al, and has the dataspace this function is a good place to transport this information into models and other
utilities.

### Models 

Models are "meta-resources" -- they don't define APIs into any particular data store, as much as encapsulate your custom code for doing so in a named hook. 

### View Helpers

View helpers "Pipe" the rendered output through a series of functions that selectively activate and pre-process data from the views' output manifest. They are the equivalent of Ruby's `after` hooks. They do *not* apply themselves to REST/raw JSON output. They trigger between `on_output` and the template rendering (EJS) stage of the request.

### Mixins

Mixins are executed once when the application boots. They are a way to insert any number of "state checking/initialization" routines into your application, especially those sort of actions that are specific and local to the needs of a particular Hive, Action or Frame. They have a weight that govens their load order. 

Hive and Express
================

In Hive, the assumption is you already have an express application, and you are looking to scale and better organize it. So hive wraps itself around an existing application, using the app and server as resources of the apiary. 
The apiary is the top level singleton of your site that is instantiated after the Express app has connected.*

Here is a typical bootstrap file with express and hive-mvc working in concert:

``` javascript

var express = require('express')
    , http = require('http') 
    , util = require('util') 
    , path = require('path');

module.exports = function (port, cb) {

    var app, server;
    app = express();

    app.configure(function () {
        app.set('port', port || 3000);
        app.set('views', __dirname + '/views');
        app.engine('html', require('ejs').renderFile);
        app.use(express.favicon());
        app.use(express.logger('dev'));
        app.use(express.bodyParser());
        app.use(express.methodOverride());
        app.use(express.cookieParser('do you mock me?'));
        app.use(express.session());
        app.use(app.router);
        app.use(express.static(path.join(__dirname, 'public')));
    });

    app.configure('development', function () {
        app.use(express.errorHandler());
    });

    server = http.createServer(app);
    server.on('close', function () {
        console.log('======== closing server');
        apiary.emit('close_server');
    });

    server.listen(app.get('port'), function () {
        var apiary = mvc.Apiary({}, path.join(__dirname, 'frames'));
        console.log('initializing apiary');
        apiary.init(function () {
            apiary.serve(app, server);
            if (cb) {
                cb(null, apiary);
            }
        });
    });

    return server;
}


```

Note that hive-mvc only kicks in AFTER the server has started to listen. Based on an unpleasant experience at a node
knockout (aptly named in my part, as the Nodejitsu system couldn't support nuby-express) I have decided to begin
bootstrapping hive-mvc AFTER the server has started to listen to a port.

The app and server are injected into the apiary in the serve portion of the bootstrapping.

Note that up to the point where you call server.listen, the configuration is 99% arbitrary - you can use whatever
config you like for express.

The only part of the app.configure that is important to hive is the app.engine; right now hive has only been tested
using html files interpreted by ejs. Also, note that hive-mvc internalizes views in each individual action, so while
its fine to have/maintain your views folder for raw Express endpoints, you won't need it for hive.

---------------------
&#42; While the architecture is designed to allow for multiple apiaries, its never been tested and I couldn't see the
point.
&#42;&#42; Hive-model does have quantum-read-write to a file system, and so is good for mocks, but its not built to be
production performant for real world repos.
