#!/usr/bin/env node
const publicIp = require('public-ip');
const Route53 = require('nice-route53');

const ipv6e = process.env.IPV6E || false
const accesskey = process.env.AWS_ACCESS_KEY || null
const secretaccesskey = process.env.AWS_SECRET_KEY || null

const r53 = new Route53({
  accessKeyId: accesskey,
  secretAccessKey: secretaccesskey
})

let zones = []

class HostedZone {
  constructor(id, domain, type, ttl) {
    this.localip = null;
    this.awsip = null;
    this.id = id;
    this.domain = domain;
    this.type = type;
    this.ttl = ttl;
  }
}

zones.push(new HostedZone('Z9MU7KVGUBNBY', 'home.arturonet.com', 'A', 600))
zones.push(new HostedZone('Z9MU7KVGUBNBY', 'mandalore.arturonet.com', 'A', 600))
zones.push(new HostedZone('Z9MU7KVGUBNBY', 'mandalore.arturonet.com', 'AAAA', 600))

async function UpdateRecord (zone, resultip) {
  let args = {
    zoneId: zone.id,
    name: zone.domain,
    type: zone.type,
    ttl: zone.ttl,
    values: [resultip]
  }

  r53.upsertRecord(args, (err, res) => {
    if (err) {
      console.error(err);
    } else {
      console.log(res);
    }
  })
}

async function getIP (zone) {
  return new Promise((resolve, reject) => {
    r53.records(zone.id, (err, data) => {
      if (err) {
        reject(err)
      } else {
        let ips = data.filter(item => {
          return (zone.domain == item.name && zone.type == item.type)
        })
        if (ips.length === 0) {
          resolve(null)
        } else {
          resolve(ips[0].values[0])
        }
      }
    })
  })
}



function Updater () {
  this.ipv6 = null;
  this.ipv4 = null;
  this.ipv6_enabled = ipv6e;

  this.getrecords = async function () {
    this.ipv4 = await publicIp.v4()
    if (this.ipv6_enabled) {
      this.ipv6 = await publicIp.v6()
      console.log(`IPv6: ${this.ipv6}\nIPv4: ${this.ipv4}`)
    } else {
      console.log(`IPv6: disabled  IPv4: this.ipv4`)
    }
  }

  this.update = async function () {
    zones.forEach(async (zone) => {
      if (zone.type === 'AAA') {
        if (this.ipv6_enabled && !zone.awsip === this.ipv6) {
          await UpdateRecord(zone, this.ipv6)
        }
      } else {
        if (zone.awsip === !this.ipv4) {
          await UpdateRecord(zone, this.ipv4)
        }
      }
    })
  }
  this.populate = async function () {
    zones.forEach(async (zone) => {
      if (zone.type === 'AAAA') {
        try {
          zone.localip = this.ipv6;
          zone.awsip = await getIP(zone)
        } catch (e) {
          console.error(err.stack)
          zone.localip = null
        }
      } else {
        try {
          zone.localip = this.ipv4;
          zone.awsip = await getIP(zone)
        } catch (e) {
          console.error(err.stack)
          zone.localip = null
        }
      }
      console.log(zone)
    })
  }
}

const updater = new Updater()

async function start () {
  await updater.getrecords()
  await updater.populate()
  await updater.update()
}

start()
setInterval(async () => {
  await updater.getrecords()
  },
  1200000
);

setInterval(async () => {
    await updater.update()
  },
  1000
);
