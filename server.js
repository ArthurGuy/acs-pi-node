var request = require('request');

var tty = require('tty');
var fs = require('fs');

var lcdplate = require('adafruit-i2c-lcd').plate;
var lcd = new lcdplate('/dev/i2c-1', 0x20);

var PouchDB = require('pouchdb');
var memberDb = new PouchDB('bb_members');
var activityDb = new PouchDB('bb_activity');

var gpio = require('rpi-gpio');

var baseRequest;

//The id of the currently active session
var activeSessionId;

var sessionMaintainIntervalTimer;


findMemberRecord('abcdefg').then(function(result) { console.log('Found Result:', result)});
findMemberRecord('rgfwae');
saveMemberRecord('abcdefg', {name:'John Doe'});

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



function init() {
    baseRequest = request.defaults({
        headers: {
            Accept: 'application/json',
            ApiKey: 'poi5wbcrnufas'
        },
        timeout: 5000
    });

    lcd.backlight(lcd.colors.ON);
    lcd.message('BBMS ACS Node');

    sendBoot();
    setInterval(sendHeartBeat, 60000);

    memberDb.info().then(function (result) {
        console.log('Local DB Records:', result.doc_count);
        lcd.clear();
        lcd.message(result.doc_count + ' member records');
    }).catch(function (error) {
        console.error(error);
    });

    //Start refreshing the screen
    var screenRefreshInterval = setInterval(refreshScreen, 2000);
}

function refreshScreen() {
    lcd.clear();
    if (activeSessionId) {
        lcd.message('Session Active\nSession ID:' + activeSessionId);
    } else {
        lcd.message('Scan Your Tag');
    }
}

function monitorKeyboard() {

    console.log('Monitoring the keyboard');


    process.stdin.setEncoding('utf8');
    var util = require('util');

    process.stdin.on('data', function (text) {
        console.log('received data:', util.inspect(text));

        var tagNumber = parseInt(text);

        hexString = pad(tagNumber.toString(16), 10).toUpperCase();

        if (activeSessionId) {
            clearInterval(sessionMaintainIntervalTimer);
            endSession();
        } else {
            startSession(hexString);
        }
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


function saveMemberRecord(tagId, data) {
    data._id = tagId;

    findMemberRecord(tagId)
    .then(function(result) {
        //Existing record
        data._rev = result._rev;
        return memberDb.put(data);
    })
    .catch(function() {
        //no existing record
        return memberDb.put(data);
    })
}

function findMemberRecord(tagId) {
    return memberDb.get(tagId);
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

/**
 * Start an activity session with a device, sets an activity id for the duration
 * 
 * @param  {string} tagId The users rfid tag
 */
function startSession(tagId) {
    console.log('Starting a session, looking up the tag', tagId);
    baseRequest
        .post({
            url: 'https://bbms.buildbrighton.com/acs/activity',
            json: true,
            body: {
                device: 'drill-1',
                tagId: tagId
            }
        },
        function (error, response, body) {
            if (!error && response.statusCode == 201) { //session created
                console.log('Status', response.body);
                activeSessionId = response.body.activityId;
                sessionMaintainIntervalTimer = setInterval(maintainSession, 10000);

                //Save the member record locally, this will be sued if we are offline
                saveMemberRecord(tagId, response.body.user);

            } else {
                console.log('Error', response.statusCode, response.body);
            }
        });
}

function maintainSession() {
    console.log('Maintaining a session', activeSessionId);
    baseRequest
        .put({
            url: 'https://bbms.buildbrighton.com/acs/activity/' + activeSessionId
        },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                //console.log('Status', response.body);
            } else {
                console.log('Error', response.statusCode, response.body);
            }
        });
}

function endSession() {
    console.log('Ending a session', activeSessionId);
    baseRequest
        .del({
            url: 'https://bbms.buildbrighton.com/acs/activity/' + activeSessionId
        },
        function (error, response, body) {
            if (!error && response.statusCode == 204) { //session destroyed
                console.log('Status', response.body);
                activeSessionId = false;

                return true;
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