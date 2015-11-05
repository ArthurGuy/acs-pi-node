var request = require('request');

var tty = require('tty');
var fs = require('fs');

var lcdplate = require('adafruit-i2c-lcd').plate;
var lcd = new lcdplate('/dev/i2c-1', 0x20);

var PouchDB = require('pouchdb');
var db = new PouchDB('bb_members');

var gpio = require('rpi-gpio');

var baseRequest;


findRecord('abcdefg').then(function(result) { console.log('Found Result:', result)});
findRecord('rgfwae');
saveRecord('abcdefg', {name:'John Doe'});

//GPIO Node Library
//rpi-gpio
//https://www.npmjs.com/package/pi-pins

//GPIO Serial
//http://blog.oscarliang.net/raspberry-pi-and-arduino-connected-serial-gpio/

//Node Serialport library
//https://github.com/voodootikigod/node-serialport



init();

monitorKeyboard();

sendHeartBeat();

//var user = lookupTag('00005AAA5C');
//console.log(user);


function init() {
    baseRequest = request.defaults({
        headers: {
            Accept: 'application/json',
            ApiKey: 'poi5wbcrnufas'
        }
    });

    sendBoot();
    setInterval(sendHeartBeat, 60000);

    db.info().then(function (result) {
        console.log('Local DB Records:', result.doc_count);
    }).catch(function (error) {
        console.error(error);
    });

    lcd.backlight(lcd.colors.ON);
    lcd.message('BBMS ACS Pi Node');

}

function monitorKeyboard() {

    console.log('Monitoring the keyboard');


    process.stdin.setEncoding('utf8');
    var util = require('util');

    process.stdin.on('data', function (text) {
        console.log('received data:', util.inspect(text));
        lookupTag(text);
    });

}

function monitorHidRawKeyboard() {

    var device = '';
    if (process.env.DEVICE_STREAM) {
        device = process.env.DEVICE_STREAM;
    } else {
        device = "/dev/stdin";
    }
    ///dev/hidraw0
    ///dev/input/event0
    ///dev/tty  -   ssh kyboard - not local

    console.log('Monitoring the stream', device);

    var number;
    var tagArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var tagNumberTotal = 0;
    var hexString = '';
    var hexChunkArray = [];
    var i = 0;

    try {
        var input = new tty.ReadStream(fs.openSync(device, "r") );
        input.setRawMode(true);

        input.on("data", function(chunk) {
            console.log("Raw:", chunk);
            //console.log("Raw 0:", chunk[0], '1:', chunk[1], '2:', chunk[2], '3:', chunk[3], '4:', chunk[4], '5:', chunk[5], '6:', chunk[6], '7:', chunk[7]);

            if (chunk[2] !== 0) {
                number = chunk[2] - 29;
                if (number === 10) {
                    number = 0;
                }
                //add the number to the tag array
                if (number < 10) {
                    tagArray[i] = number;

                    tagNumberTotal += number * Math.pow(10, (9 - i));
                    i++;
                }
                //console.log('Converted Number:', number);

                //carrage return
                if (number === 11) {

                    //console.log("Tag ID Array:", tagArray);
                    //console.log("Tag Number (decimal):", tagNumberTotal);
                    //console.log("Tag Number (hex):", tagNumberTotal.toString(16));
                    hexString = pad(tagNumberTotal.toString(16), 10).toUpperCase();
                    //console.log("Padded Tag Number (hex):", hexString);

                    hexChunkArray = hexString.match(/.{1,2}/g);
                    //console.log("Hex chunk array:", hexChunkArray);

                    //The checksum cant be calculated as we dont have the first part of the number

                    lookupTag(hexString)
                    .then(function (message) {
                        console.log(message);
                    });

                    //Reset variables
                    tagArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                    tagNumberTotal = 0;
                    hexChunkArray = [];
                    hexString = '';
                    i = 0;
                }
            }
        });

        input.on('error', function(err) {
            console.log(err);

            //Try and connect again in 10 seconds
            setTimeout(monitorKeyboard, 10000);
        });

    } catch (error) {
        console.log("Error listening to the RFID Reader");
        console.log(error);

        //Try and connect again in 10 seconds
        setTimeout(monitorKeyboard, 10000);
    }

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
    baseRequest.post(
        'https://bbms.buildbrighton.com/acs/node/heartbeat', {},
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log('Heartbeat sent');
            } else {
                console.log('Error sending heartbeat message', response.statusCode, response.body);
            }
        }
    );
}
function sendBoot() {
    baseRequest.post(
        'https://bbms.buildbrighton.com/acs/node/boot', {},
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                //console.log(body);
                console.log('Boot message sent');
            } else {
                console.log('Error sending boot message', response.statusCode, response.body);
            }
        }
    );
}

function lookupTag(tagId) {
    console.log('Looking up tag', tagId);
    baseRequest
        .get('https://bbms.buildbrighton.com/acs/status/'+tagId,
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log('Status', response.body);
                return response.body;
            } else {
                console.log('Error', response.statusCode, response.body);
            }
        });
}

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}