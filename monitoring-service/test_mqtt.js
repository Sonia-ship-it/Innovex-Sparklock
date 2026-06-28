const mqtt = require('mqtt');
const url = 'mqtt://broker.benax.rw:1883';
console.log('Connecting to', url);

const client = mqtt.connect(url);

client.on('connect', () => {
    console.log('Connected to MQTT');
    client.subscribe('sparklock/#');
    client.subscribe('SPARKLOCK/#');
});

client.on('message', (topic, message) => {
    console.log('Message arrived on topic:', topic);
    console.log(message.toString());
});

setTimeout(() => {
    client.end();
    console.log('Finished listening.');
}, 20000);
