# fake-kabus-websocket-server

## これは何？

kabu STATION APIのうち、 PUSH APIのレスポンスを保存しておくサーバや、それを模擬的に返すサーバで構成されるリポジトリ。また、デフォルトの値を流し続けるサーバも含まれる。

ロジックの開発を行う際、市場が動いていなくても動作確認を行えるようにする目的で開発した。


## 本リポジトリに含まれるもの

`docker compose up ${SERVICE_NAME}` で起動できるサーバは下記の通りである。

- `db`
- `db_init`
- `recorder`
- `socket_dummy`
- `socket_db`
- `token`
- `nginx`

## `db` データベースサーバ

本リポジトリではPostgreSQLを使用しているが、固有の機能は使用していないので、本質的にはMySQLでもSQLiteでも使用可能であると思われる（未検証）。

初回起動時は、次に紹介する `db_init` によるデータベースの初期化が必要である。


## `db_init` データベースを初期化するサーバ

初期化とは言いつつも、現状ではdatabaseを新規作成する `CREATE DATABASE` を発行するのみである。

PostgreSQL向けの `command` を発行しているため、DBサーバをPostgreSQLから変更した場合は、 `compose.yml` の `command` も変更する必要がある。


## `recorder` WebSocketメッセージを記録するサーバ

`environment` で指定したWebSocketサーバに接続し、そこから流れてくるメッセージを記録する。

kabu STATION API 向けに記述しているため、他のWebSocketサーバに対し汎用的ではない。


## `socket_dummy` デフォルトの値を流し続けるWebSocketサーバ

`./socket_dummy/index.js` の `output` で指定した値を流し続けるだけのWebSocketサーバである。

ただし、メッセージ中の現在時刻のみ、現実世界での現在時刻と同期する。


## `token` トークンを発行するサーバ

https://kabucom.github.io/kabusapi/reference/index.html#tag/auth に相当するダミーのレスポンスを返すサーバ。


## `nginx` リバースプロキシ

`token` , `socket_dummy` , `socket_db` に対し、 `https` / `wss` でアクセスできるようにするためのリバースプロキシである。



# 使い方

いくつかのユースケースに合わせて、使い方を説明する。

## 0. 共通セットアップ

```sh
$ git clone https://github.com/dogwood008/fake-kabus-websocket-server.git
$ cd fake-kabus-websocket-server
$ docker compose build
```

## 1. 固定値を返すだけのサーバを立てたい

```sh
$ docker compose up -d socket_dummy
$ docker compose up -d nginx
```

上記のコマンドを実行すると、 `ws://localhost:18080/kabusapi/websocket` でWebSocketサーバが立ち上がる。このサーバは下記のようなメッセージを流し続ける。

このサーバは、 `TradingVolumeTime` `CurrentPriceTime` を現在時刻で更新しつつ、ランダムな時間間隔を開けて無限に送信し続ける。その間隔は500 -- 1300ミリ秒（=0.5 -- 1.3秒）に設定されている。

制限事項として現在時刻は日本時間から9時間遅れていることに注意すること。（必要になったら対応する）


<details>
    <summary>送信されるメッセージ例</summary>

```javascript
{
  "OverSellQty": 187600,
  "UnderBuyQty": 115300,
  "TotalMarketValue": 7222044650000,
  "MarketOrderSellQty": 0,
  "MarketOrderBuyQty": 0,
  "BidTime": "2021-09-10T11:12:23+09:00",
  "AskTime": "2021-09-10T11:12:23+09:00",
  "Exchange": 1,
  "ExchangeName": "東証１部",
  "TradingVolume": 476400,
  "TradingVolumeTime": "2022-09-18T12:25:44.957+09:00",
  "VWAP": 54702.097,
  "TradingValue": 26060079000,
  "BidQty": 600,
  "BidPrice": 54870,
  "BidSign": "0101",
  "Sell1": {
    "Price": 54870,
    "Qty": 600,
    "Sign": "0101",
    "Time": "2021-09-10T11:12:23+09:00"
  },
  "Sell2": {
    "Price": 54880,
    "Qty": 600
  },
  "Sell3": {
    "Price": 54890,
    "Qty": 1500
  },
  "Sell4": {
    "Price": 54900,
    "Qty": 1400
  },
  "Sell5": {
    "Price": 54910,
    "Qty": 500
  },
  "Sell6": {
    "Price": 54920,
    "Qty": 800
  },
  "Sell7": {
    "Price": 54930,
    "Qty": 900
  },
  "Sell8": {
    "Price": 54940,
    "Qty": 800
  },
  "Sell9": {
    "Price": 54950,
    "Qty": 800
  },
  "Sell10": {
    "Price": 54960,
    "Qty": 800
  },
  "AskQty": 200,
  "AskPrice": 54840,
  "AskSign": "0101",
  "Buy1": {
    "Price": 54840,
    "Qty": 200,
    "Sign": "0101",
    "Time": "2021-09-10T11:12:23+09:00"
  },
  "Buy2": {
    "Price": 54830,
    "Qty": 500
  },
  "Buy3": {
    "Price": 54820,
    "Qty": 500
  },
  "Buy4": {
    "Price": 54810,
    "Qty": 1000
  },
  "Buy5": {
    "Price": 54800,
    "Qty": 600
  },
  "Buy6": {
    "Price": 54790,
    "Qty": 1400
  },
  "Buy7": {
    "Price": 54780,
    "Qty": 700
  },
  "Buy8": {
    "Price": 54770,
    "Qty": 1000
  },
  "Buy9": {
    "Price": 54760,
    "Qty": 300
  },
  "Buy10": {
    "Price": 54750,
    "Qty": 400
  },
  "Symbol": "7974",
  "SymbolName": "任天堂",
  "CurrentPrice": 54850,
  "CurrentPriceTime": "2022-09-18T12:25:44.957+09:00",
  "CurrentPriceChangeStatus": "0056",
  "CurrentPriceStatus": 1,
  "CalcPrice": 54850,
  "PreviousClose": 54340,
  "PreviousCloseTime": "2021-09-09T00:00:00+09:00",
  "ChangePreviousClose": 510,
  "ChangePreviousClosePer": 0.94,
  "OpeningPrice": 54400,
  "OpeningPriceTime": "2021-09-10T09:00:00+09:00",
  "HighPrice": 55090,
  "HighPriceTime": "2021-09-10T09:07:49+09:00",
  "LowPrice": 54400,
  "LowPriceTime": "2021-09-10T09:00:00+09:00",
  "SecurityType": 1
}
```

</details>

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
