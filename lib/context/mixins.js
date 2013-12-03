var _ = require('underscore');
var path = require('path');
var Configuration = require('hive-configuration');
var fs = require('fs');
var _mixins = {

    $parse_body: require('./parse_body'),

    $go: function (url, cb) {
        this.$res.redirect(url);
        if (cb) cb('redirect');
    },

    $send: function () {
        var args = _.toArray(arguments);
        var cb;
        if (_.isFunction(_.last(args))) {
            cb = args.pop();
        }

        if (!args.length) {
            if (!this.$out) {
                return cb(new Error('no output to send'));
            }
            var output = (this.$out instanceof Configuration) ? this.$out.valueOf() : this.$out.toJSON ? this.$out.toJSON() : this.$out;
            this.$res.send(output);
        } else {
            this.$res.send.apply(this.$res, args);
        }

        if (cb) cb('json');
    },

    $sendfile: function (file_path, cb, fast) {
        if (!file_path){
            if (cb){
                cb(new Error('no file path'));
            } else {
                this.$res.send('no file path');
            }
        } else if (!_.isString(file_path)){
            if (cb){
                cb(new Error('file path is not string: ' + util.inspect(file_path)));
            } else {
                this.$res.send('file path is not string: '+ util.inspect(file_path));
            }
        } else if (fast){
            this.$res.sendfile(file_path);
            if (cb) cb('redirect');
        } else {
            var self = this;
            fs.exists(file_path, function (file_exists) {
                if (!file_exists) {
                    if (cb ) {
                        cb(new Error('file not found: ' + file_path));
                    } else {
                        self.$res.send('file not found: ' + file_path);
                    }
                } else {
                    self.$res.sendfile(file_path);
                    if (cb) cb('redirect');
                }
            })
        }
    },

    $render: require('./render'),

    $flash: function (type, msg) {
        this.$req.flash(type, msg);
    },

    $phase: function () {
        if (this.$phases.length) {
            return _.last(this.$phases);
        } else {
            return 'UNKNOWN';
        }
    }

};

_.extend(_mixins, require('./session'));

module.exports = _mixins;