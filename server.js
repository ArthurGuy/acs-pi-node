var request = require('request');

var tty = require('tty');
var fs = require('fs');

var PouchDB = require('pouchdb');
var db = new PouchDB('bb_members');

//var gpio = require('rpi-gpio');




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



function init() {
    sendBoot();
    setInterval(sendHeartBeat, 60000);

    db.info().then(function (result) {
        console.log('Local DB Records:', result.doc_count);
    }).catch(function (error) {
        console.error(error);
    });

}

function monitorKeyboard() {

    var device = '';
    if (process.env.DEVICE_STREAM) {
        device = process.env.DEVICE_STREAM;
    } else {
        device = "/dev/tty";
    }
    ///dev/hidraw0
    ///dev/input/event0

    console.log('Monitoring the stream', device);

    var number;
    var tagArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var tagNumberTotal = 0;
    var hexString = '';
    var hexChunkArray = [];
    var checksum = '';
    var i = 0;

    try {
        var input = new tty.ReadStream(fs.openSync(device, "r") );
        input.setRawMode(true);

        input.on("data", function(chunk) {
            //console.log("Raw:", chunk);
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
                    console.log("Padded Tag Number (hex):", hexString);

                    hexChunkArray = hexString.match(/.{1,2}/g);
                    console.log("Hex chunk array:", hexChunkArray);
                    /*
                    checksum = hexChunkArray[0];
                    for (var x = 1; x < 5; x++) {
                        checksum ^= hexChunkArray[x];
                    }
                    console.log('Checksum: ', checksum.toString(16));
                    */

                    lookupTag(hexString);

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


    /*
    process.stdin.setEncoding('utf8');
    var util = require('util');

    process.stdin.on('data', function (text) {
        console.log('received data:', util.inspect(text));
        lookupTag(text);
    });
    */
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

function lookupTag(tagId) {
    console.log('Looking up tag', tagId);
    request.post(
        'https://bbms.buildbrighton.com/acs', {
            json: {
                device: 'pi-node-test',
                service: 'status',
                message: 'lookup',
                tag: tagId,
                time: Math.floor(Date.now() / 1000)
            }
        },
        function (error, response, body) {
            if (error) {
                console.log(error);
            } else {
                console.log('Tag lookup sent', body);
            }
        }
    );
}

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}