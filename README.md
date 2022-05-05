# fake-kabus-websocket-server

## これは何？

kabu STATION APIのうち、 PUSH APIのレスポンスを模擬的に返すサーバ。ロジックの開発を行う際、市場が動いていなくても動作確認を行えるようにする目的で開発した。

## セットアップ

```sh
$ git clone https://github.com/dogwood008/fake-kabus-websocket-server.git
$ cd fake-kabus-websocket-server
$ docker-compose build
```

## 使い方

### 待ち受け

```sh
$ docker-compose up
```

### 動作している様子

#### トークンの取得

```js
$ curl -X POST localhost:18080/kabusapi/token
{"ResultCode":0,"Token":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
```

#### 歩み値の取得

```js
$ curl -i -N --include \
     --no-buffer \
     --header "Connection: Upgrade" \
     --header "Upgrade: websocket" \
     --header "Host: localhost:18080" \
     --header "Origin: http://localhost:18080" \
     --header "Sec-WebSocket-Key: +onQ3ZxjWlkNa0na6ydhNg==" \
     --header "Sec-WebSocket-Version: 13" \
     http://localhost:18080/kabusapi/websocket
HTTP/1.1 101 Switching Protocols
Server: nginx/1.21.3
Date: Thu, 16 Sep 2021 14:17:00 GMT
Connection: upgrade
Upgrade: websocket
Sec-WebSocket-Accept: KXGdZMoi2440O31GaOAuKsZfThY=

�~�{"OverSellQty":187600,"UnderBuyQty":115300,"TotalMarketValue":7222044650000,"MarketOrderSellQty":0,"MarketOrderBuyQty":0,"BidTime":"2021-09-10T11:12:23+09:00","AskTime":"2021-09-10T11:12:23+09:00" ... （省略）
```
