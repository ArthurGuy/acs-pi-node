var request = require('request');

var PouchDB = require('pouchdb');
var db = new PouchDB('bb_members');

var serialPort = require("serialport");
var gpio = require('rpi-gpio');




findRecord('abcdefg').then(function(result) { console.log('Found Result:', result)});
findRecord('rgfwae');
saveRecord('abcdefg', {name:'John Doe'});

//GPIO Node Library
//rpi-gpio

//GPIO Serial
//http://blog.oscarliang.net/raspberry-pi-and-arduino-connected-serial-gpio/

//Node Serialport library
//https://github.com/voodootikigod/node-serialport

init();

listSerialPorts();




function init() {
    sendBoot();
    setInterval(sendHeartBeat, 60000);

    db.info().then(function (result) {
        console.log('Local DB Records:', result.doc_count);
    }).catch(function (error) {
        console.error(error);
    });

    //RFID Reset pin - hold high
    gpio.setup(18, gpio.DIR_OUT, readInput);
    gpio.write(18, 1);
}

function listSerialPorts() {
    serialPort.list(function (err, ports) {
      ports.forEach(function(port) {
        console.log(port.comName);
        console.log(port.pnpId);
        console.log(port.manufacturer);
      });
    });
}


function saveRecord(tagId, data) {
    data._id = tagId;

    findRecord(tagId)
    .then(function(result) {
        //Existing record
        data._rev = result._rev;
        return db.put(data);
    })
    .catch(function() {
        //no existing record
        return db.put(data);
    })
}

function findRecord(tagId) {
    return db.get(tagId);
}

function sendHeartBeat() {
    request.post(
        'https://bbms.buildbrighton.com/acs', {
            json: {
                device: 'pi-node-test',
                service: 'status',
                message: 'heartbeat',
                time: Math.floor(Date.now() / 1000)
            }
        },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log('Heartbeat sent');
            }
        }
    );
}
function sendBoot() {
    request.post(
        'https://bbms.buildbrighton.com/acs', {
            json: {
                device: 'pi-node-test',
                service: 'status',
                message: 'boot',
                time: Math.floor(Date.now() / 1000)
            }
        },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                //console.log(body);
                console.log('Boot message sent');
            }
        }
    );
}