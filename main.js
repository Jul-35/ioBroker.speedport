"use strict";

/*
 * Created with @iobroker/create-adapter v1.32.0
 */

const utils = require("@iobroker/adapter-core");
const W925V = require("./lib/w925v");

class Speedport extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "speedport",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {

        // setup timer
        this.interval = this.config.interval || 60;
        this.interval *= 1000;
        if (this.interval < 10000)
            this.interval = 10000;

        this.client = new W925V(this.config.host, this.config.password);

        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);

        this.log.info(`Establish connection to Speedport (${this.config.host})`);
        this.update();
    }

    update() {
        this.client.login()
            .then(() => this.connectionHandler(true))
            .then(() => this.client.getMemCpuUtilization())
            .then(metrics => this.setStates(metrics))
            .then(() => this.client.getDsl())
            .then(metrics => this.setStates(metrics))
            .then(() => this.client.getInterfaceLan())
            .then(metrics => this.setStates(metrics))
            .then(() => this.client.getInterfaceWan())
            .then(metrics => this.setStates(metrics))
            .catch((error) => {
                this.errorHandler(error);
                this.refreshTimer();
            });
    }

    refreshTimer() {
        this.log.debug("Reset Timer");
        this.timer = setTimeout(() => this.update(), this.interval);
    }

    async setStates(metrics) {
        for (const metric of metrics) {
            this.setObjectNotExistsAsync(metric.id, metric.obj)
                .then(() => this.setStateAsync(metric.id, {val: metric.value, ack: true}));
        }
    }

    errorHandler(error) {
        this.log.error(error.message);
        if (error.stack)
            this.log.error(error.stack);
        this.connectionHandler(false);
    }

    connectionHandler(connected) {
        if (this.connection !== connected) {
            this.connection = connected;
            if (connected)
                this.log.info("Connection established successfully");
            else
                this.log.error("Connection failed");

            this.setState("info.connection", this.connection, true);
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            clearTimeout(this.timer);
            this.log.info("cleaned everything.");

            callback();
        } catch (e) {
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Speedport(options);
} else {
    // otherwise start the instance directly
    new Speedport();
}