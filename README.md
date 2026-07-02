<https://developer.legrand.com/documentation/open-web-net-for-myhome/>

## Listen to the OpenWebNet bus

Copy `config/listen-bus.sample.yaml` to `config/listen-bus.yaml`, set the
gateway connection values, then run:

```sh
pnpm listen-bus
```

Use `CONFIG_FILE=/path/to/listen-bus.yaml` to load config from another path.
