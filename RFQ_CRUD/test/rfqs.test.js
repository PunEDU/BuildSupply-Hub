const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomInt } = require('node:crypto');
const { after, before, test } = require('node:test');
const { createApp } = require('../app');
const { createPool } = require('../db');
const { createRfqStore } = require('../rfq-store');

const base = '/contractor/rfqs';
const buyerId = randomInt(1000000000, 2000000000);
let pool;
let server;
let siteId;
let unitId;

before(async () => {
    pool = createPool();
    assert.equal((await pool.query('SELECT DATABASE() AS name'))[0][0].name, 'buildsupply_assignment4',
        'Run this test against the dedicated Assignment 4 database.');
    [[{ jobsite_id: siteId }]] = await pool.query('SELECT jobsite_id FROM jobsite ORDER BY jobsite_id LIMIT 1');
    [[{ unit_id: unitId }]] = await pool.query('SELECT unit_id FROM unit ORDER BY unit_id LIMIT 1');
    await pool.execute('INSERT INTO buyer_jobsite (buyer_id, jobsite_id) VALUES (?, ?)', [buyerId, siteId]);
    server = createApp(createRfqStore(pool), buyerId).listen(0, '127.0.0.1');
    await once(server, 'listening');
});

after(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (pool) {
        try {
            if (siteId) {
                await pool.execute('DELETE FROM rfq WHERE created_by_user_id = ?', [buyerId]);
                await pool.execute('DELETE FROM buyer_jobsite WHERE buyer_id = ?', [buyerId]);
            }
        } finally {
            await pool.end();
        }
    }
});

function get(path, headers) {
    return fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers });
}

function post(path, fields, headers) {
    return fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method: 'POST', redirect: 'manual', body: new URLSearchParams(fields), headers,
    });
}

async function addDraft(fields = {}) {
    const response = await post(base, fields);
    assert.equal(response.status, 303);
    return response.headers.get('location');
}

test('RFQ create, read, update and delete through the contractor pages', async () => {
    const rfq = await addDraft();
    const detail = await (await get(rfq)).text();
    const number = detail.match(/RFQ-[A-F0-9]{16}/)[0];
    assert.match(detail, /No materials yet/);
    assert.match(await (await get(base)).text(), new RegExp(number));

    let response = await post(`${rfq}/edit`, {
        lock_version: 1, jobsite_id: siteId,
        requested_delivery_start: '2026-11-30T12:00', requested_delivery_end: '2026-11-30T11:00',
    });
    assert.equal(response.status, 422);
    assert.match(await response.text(), /delivery end must be on or after the start/);

    response = await post(`${rfq}/edit`, {
        lock_version: 1, jobsite_id: siteId, delivery_address_text: 'North gate',
        requested_delivery_start: '2026-11-30T10:00', requested_delivery_end: '2026-11-30T12:00',
    });
    assert.equal(response.status, 303);
    assert.match(await (await get(rfq)).text(), /North gate/);
    assert.match(await (await get(`${rfq}/edit`)).text(), /value="2026-11-30T10:00"/);
    assert.equal((await post(`${rfq}/delete`, { lock_version: 1 })).status, 409);
    assert.equal((await post(`${rfq}/delete`, { lock_version: 2 })).status, 303);
    assert.equal((await get(rfq)).status, 404);
    assert.doesNotMatch(await (await get(base)).text(), new RegExp(number));
});

test('material CRUD returns HTMX fragments, preserves quantity and also works without HTMX', async () => {
    const rfq = await addDraft();
    const items = `${rfq}/items`;
    const id = Number(rfq.split('/').at(-1));
    const hx = { 'HX-Request': 'true' };
    const invalid = await post(items, { material_name: 'Mortar', requested_quantity: '-2' }, hx);
    assert.equal(invalid.status, 422);
    assert.match(await invalid.text(), /positive quantity/);

    const responses = await Promise.all([
        post(items, { material_name: 'Cement <Type I>', requested_quantity: '25.125', unit_id: unitId }, hx),
        post(items, { material_name: 'Mortar' }),
    ]);
    assert.equal(responses[0].status, 200);
    const fragment = await responses[0].text();
    assert.match(fragment, /<section id="rfq-items"/);
    assert.match(fragment, /Cement &lt;Type I&gt;/);
    assert.doesNotMatch(fragment, /<!doctype html>/i);
    assert.equal(responses[1].status, 303);

    const [stored] = await pool.execute('SELECT * FROM rfq_item WHERE rfq_id = ? ORDER BY line_no', [id]);
    assert.deepEqual(stored.map(item => item.line_no), [1, 2]);
    const cement = stored.find(item => item.material_name.startsWith('Cement'));
    assert.equal(cement.requested_quantity, '25.1250');
    const item = `${items}/${cement.rfq_item_id}`;
    assert.match(await (await get(`${item}/edit`, hx)).text(), /Save material/);
    const updated = await post(`${item}/edit`, {
        lock_version: 1, material_name: 'Cement revised', specification_text: 'Type I, dry storage',
    }, hx);
    assert.equal(updated.status, 200);
    assert.match(await updated.text(), /Cement revised/);
    assert.equal((await post(`${item}/delete`, { lock_version: 1 }, hx)).status, 409);
    assert.equal((await post(`${item}/delete`, { lock_version: 2 })).status, 303);
    assert.doesNotMatch(await (await get(rfq)).text(), /Cement revised/);
    assert.match(await (await get(rfq)).text(), /Mortar/);

    assert.equal((await post(`${rfq}/delete`, { lock_version: 1 })).status, 303);
    const [remaining] = await pool.execute('SELECT rfq_item_id FROM rfq_item WHERE rfq_id = ?', [id]);
    assert.equal(remaining.length, 0);
});

test('sent RFQs are read-only and buyer and RFQ scopes limit access', async () => {
    const hiddenId = (await pool.execute('INSERT INTO rfq (rfq_number, created_by_user_id) VALUES (?, ?)',
        [`TEST-${buyerId}`, buyerId + 1]))[0].insertId;
    try {
        assert.equal((await get(`${base}/${hiddenId}`)).status, 404);
        assert.equal((await post(`${base}/${hiddenId}/delete`, { lock_version: 1 })).status, 404);
    } finally {
        await pool.execute('DELETE FROM rfq WHERE rfq_id = ?', [hiddenId]);
    }

    const rfq = await addDraft();
    const rfqId = Number(rfq.split('/').at(-1));
    await post(`${rfq}/items`, { material_name: 'Sand' });
    const [[item]] = await pool.execute('SELECT rfq_item_id FROM rfq_item WHERE rfq_id = ?', [rfqId]);
    const other = await addDraft();
    assert.equal((await post(`${other}/items/${item.rfq_item_id}/delete`, { lock_version: 1 })).status, 409);

    await pool.execute("UPDATE rfq SET status = 'SENT' WHERE rfq_id = ?", [rfqId]);
    const detail = await (await get(rfq)).text();
    assert.match(detail, /Sand/);
    assert.doesNotMatch(detail, /Delete this draft|Add material/);
    assert.equal((await post(`${rfq}/edit`, { lock_version: 1 })).status, 409);
    assert.equal((await post(`${rfq}/delete`, { lock_version: 1 })).status, 409);
    assert.equal((await post(`${rfq}/items`, { material_name: 'Gravel' })).status, 409);
    assert.equal((await post(`${rfq}/items/${item.rfq_item_id}/edit`, { lock_version: 1, material_name: 'Gravel' })).status, 409);
    assert.equal((await post(`${rfq}/items/${item.rfq_item_id}/delete`, { lock_version: 1 })).status, 409);
});
