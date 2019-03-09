const express = require('express');
const fetch = require('node-fetch');
const { URL, URLSearchParams } = require('url');
const datastore = require('nedb-promise');
const postMsg = require('./src/post-msg');

const db = {};
db.rakuten = new datastore({ filename: '.data/rakuten.db', autoload: true });

const app = express();

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', (request, response) => {
  response.sendFile(`${__dirname}/views/index.html`);
});

const API_URL = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706';
const apiUrlObj = new URL(API_URL);
const targetItems = [
  { itemCode: 'yamada-denki:10176069', postName: '任天堂 Nintendo Switch Joy-Con(L) ネオンブルー/(R) ネオンレッド HAC-S-KABAA' },
  { itemCode: 'yamada-denki:10176080', postName: '任天堂 Nintendo Switch Joy-Con(L)/(R) グレー HAC-S-KAAAA' },
  { itemCode: 'goosimseller:10000580', postName: 'ASUS ZenFone Live (L1) (ZA550KL) SIMフリー（OCN モバイル ONEパッケージ付き）' },
];

const getRakutenData = async function (item) {
  const params = new URLSearchParams();
  const paramData = {
    format: 'json',
    itemCode: item.itemCode,
    availability: 0,
    applicationId: process.env.RAKUTEN_APPID,
  };
  
  Object.keys(paramData).forEach((key) => {
    params.append(key, paramData[key]);
  });
  apiUrlObj.search = params.toString();
  
  try {
    const res = await fetch(apiUrlObj);
    const jsonRes = await res.json();
    // console.log(jsonRes.count);
    // console.log(jsonRes.Items[0]);
    // console.log(jsonRes.Items[0].Item.availability);
    return jsonRes.Items[0].Item;
  } catch (err) {
    console.log(err);
    throw new Error('Error: Could not get the data');
  }
}

const detectChange = async function (item, latestData) {
  const query = {itemCode: item.itemCode};
  const doc = {
    itemCode: item.itemCode,
    availability: latestData.availability
  };
    
  const pastData = await db.rakuten.find(query);
  // console.log(pastData);
  
  // テスト用
  // latestData.availability = 1;
  //
  
  if (pastData.length === 1) {
    // データが1つあった場合、過去のデータの売り切れ状態を比較する
    // [変更なし] 何もしない、[変更有 & 在庫あり状態から売り切れ] データをアップデート、[変更有 & 売り切れから在庫あり状態に変更] データをアップデート & 通知
    if (pastData[0].availability !== latestData.availability) {
      if (latestData.availability === 0) {
        console.log('Change: Sold out');
      } else if (latestData.availability === 1) {
        console.log('Change: Available');
        postMsg.slack(item.postName, latestData.itemUrl);
      }
      await db.rakuten.update(query, doc);
    } else {
      // console.log('No change to the data');
    }
  } else if (pastData.length === 0) {
    // データが空だった場合、データを挿入
    console.log('Insert data');
    await db.rakuten.insert(doc);
    
  } else {
    // データが2つ以上だった場合、予想外の状況
    console.log('Error: There is a lot of data.');
    console.log(pastData);
    // await db.rakuten.remove({}, { multi: true });  // 全データ削除
    // const allData = await db.rakuten.find({});  // 全データ取得
    // console.log(allData);
  }
  
  // const allData = await db.rakuten.find({});  // 全データ取得
  // console.log(allData);
  // await db.rakuten.remove({}, { multi: true });  // 全データ削除
  
}

const sleep = function (msec) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), msec);
  });
}

const start = async function () {
  for (let item of targetItems) {
    getRakutenData(item).then((latestData) => {
      detectChange(item, latestData).catch(console.error);
    }).catch(console.error);
    await sleep(2000);  // 楽天APIの制限が1秒1リクエストのため、次のリクエストまで数秒スリープする
  }
};

setInterval(start, 60000);

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});
