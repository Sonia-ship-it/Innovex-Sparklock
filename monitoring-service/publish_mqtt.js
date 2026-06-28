const mqtt = require('mqtt');
const url = 'mqtt://broker.benax.rw:1883';
const client = mqtt.connect(url);

client.on('connect', () => {
    console.log('Publishing mock data...');
    setInterval(() => {
        const pcmData = {
            temperature: 25 + Math.random() * 5,
            humidity: 50 + Math.random() * 10,
            current: Math.random() * 5,
            relay: 'ON',
            buzzer: 'OFF',
            led: 'GREEN',
            ts: Math.floor(Date.now() / 1000)
        };
        client.publish('sparklock/sensor', JSON.stringify(pcmData));
        console.log('Published PCM:', pcmData);

        const kcmData = {
            flame: Math.random() > 0.9 ? 1 : 0,
            gas: Math.random() > 0.8 ? 1 : 0,
            gas_detected: Math.random() > 0.8 ? 1 : 0,
            gas_value: 300 + Math.random() * 100,
            ts: Math.floor(Date.now() / 1000)
        };
        client.publish('SPARKLOCK/sensor', JSON.stringify(kcmData));
        console.log('Published KCM:', kcmData);

    }, 2000);
});
