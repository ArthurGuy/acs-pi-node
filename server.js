var request = require('request');

var PouchDB = require('pouchdb');
var db = new PouchDB('bb_members');



db.put({
  _id: '123abc',
  name: 'David'
}).then(function (response) {
  // handle response
}).catch(function (err) {
  console.error(err);
});




//rpi-gpio

init();





function init() {
    sendBoot();
    setInterval(sendHeartBeat, 60000);

    db.info().then(function (result) {
        console.log('Local DB Records:', result.doc_count);
    }).catch(function (err) {
        console.error(err);
    });
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