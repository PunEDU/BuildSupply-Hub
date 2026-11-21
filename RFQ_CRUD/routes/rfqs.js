const express = require('express');
const { positiveId, rfqInput, itemInput } = require('../rfq-input');

const listPath = '/contractor/rfqs';
const missing = res => res.status(404).render('message', { title: 'RFQ or material not found' });
const locked = 'This RFQ can no longer be changed because it is not a draft.';
const stale = 'This record changed after you opened it. Review the latest data and try again.';

function dateInput(value) {
    return value ? value.slice(0, 16).replace(' ', 'T') : '';
}

function createRfqRouter(store, buyerId) {
    const router = express.Router();
    router.use((_req, res, next) => {
        res.set('Cache-Control', 'no-store').vary('HX-Request');
        next();
    });
    router.param('rfqId', async (req, res, next, value) => {
        const id = positiveId(value);
        req.rfq = id && await store.getRfq(buyerId, id);
        if (!req.rfq) return missing(res);
        req.rfqPath = `${listPath}/${id}`;
        next();
    });
    router.param('itemId', (req, res, next, value) => {
        req.itemId = positiveId(value);
        if (!req.itemId) return missing(res);
        next();
    });

    function draftForm(res, { sites, rfq, values = {}, errors = {}, status = 200 }) {
        const action = rfq ? `${listPath}/${rfq.rfq_id}/edit` : listPath;
        return res.status(status).render('rfq-form', {
            title: rfq ? 'Edit RFQ draft' : 'Create RFQ draft',
            action, rfq, sites, values, errors,
        });
    }

    async function detail(req, res, options = {}) {
        const rfq = req.rfq;
        const [items, units] = await Promise.all([store.listItems(rfq.rfq_id), store.listUnits()]);
        const editing = options.editId ? items.find(item => item.rfq_item_id === options.editId) : null;
        if (options.editId && !editing) return missing(res);
        const itemsPath = `${req.rfqPath}/items`;
        const context = {
            title: rfq.rfq_number,
            rfq, items, units, itemsPath, editing,
            values: options.values || editing || {},
            errors: options.errors,
            notice: options.notice,
            rfqPath: req.rfqPath,
            itemAction: editing ? `${itemsPath}/${editing.rfq_item_id}/edit` : itemsPath,
            isDraft: rfq.status === 'DRAFT',
        };
        res.status(options.status || 200);
        if (options.fragment && req.get('HX-Request') === 'true') {
            return res.render('partials/rfq-items', { ...context, layout: false });
        }
        return res.render('rfq-detail', context);
    }

    async function conflict(req, res, outcome, fragment = false) {
        if (outcome === 'missing') return missing(res);
        req.rfq = await store.getRfq(buyerId, req.rfq.rfq_id);
        if (!req.rfq) return missing(res);
        return detail(req, res, { status: 409, notice: outcome === 'locked' ? locked : stale, fragment });
    }

    router.get('/', async (_req, res) => {
        res.render('rfq-list', { title: 'Requests for quotation', rfqs: await store.listRfqs(buyerId) });
    });

    router.get('/new', async (_req, res) => draftForm(res, { sites: await store.listSites(buyerId) }));

    router.post('/', async (req, res) => {
        const sites = await store.listSites(buyerId);
        const { values, errors, fields } = rfqInput(req.body, sites);
        if (Object.keys(errors).length) return draftForm(res, { sites, values, errors, status: 422 });
        const id = await store.addRfq(buyerId, fields);
        res.redirect(303, `${listPath}/${id}`);
    });

    router.get('/:rfqId', (req, res) => detail(req, res));

    router.get('/:rfqId/edit', async (req, res) => {
        const rfq = req.rfq;
        if (rfq.status !== 'DRAFT') return conflict(req, res, 'locked');
        const values = {
            ...rfq,
            requested_delivery_start: dateInput(rfq.requested_delivery_start),
            requested_delivery_end: dateInput(rfq.requested_delivery_end),
        };
        return draftForm(res, { sites: await store.listSites(buyerId), rfq, values });
    });

    router.post('/:rfqId/edit', async (req, res) => {
        const rfq = req.rfq;
        if (rfq.status !== 'DRAFT') return conflict(req, res, 'locked');
        const version = positiveId(req.body?.lock_version);
        if (rfq.lock_version !== version) return conflict(req, res, 'stale');
        const sites = await store.listSites(buyerId);
        const { values, errors, fields } = rfqInput(req.body, sites);
        if (Object.keys(errors).length) return draftForm(res, { sites, rfq, values, errors, status: 422 });
        const outcome = await store.updateRfq(buyerId, rfq.rfq_id, version, fields);
        if (outcome !== 'saved') return conflict(req, res, outcome);
        res.redirect(303, req.rfqPath);
    });

    router.post('/:rfqId/delete', async (req, res) => {
        const outcome = await store.deleteRfq(buyerId, req.rfq.rfq_id, positiveId(req.body?.lock_version));
        if (outcome !== 'saved') return conflict(req, res, outcome);
        res.redirect(303, listPath);
    });

    router.get('/:rfqId/items', (req, res) => detail(req, res, { fragment: true }));

    router.get('/:rfqId/items/:itemId/edit', (req, res) => {
        if (req.rfq.status !== 'DRAFT') return conflict(req, res, 'locked', true);
        return detail(req, res, { editId: req.itemId, fragment: true });
    });

    async function saveItem(req, res) {
        if (req.rfq.status !== 'DRAFT') return conflict(req, res, 'locked', true);
        const version = positiveId(req.body?.lock_version);
        const rfqId = req.rfq.rfq_id;
        if (req.itemId) {
            const item = (await store.listItems(rfqId)).find(row => row.rfq_item_id === req.itemId);
            if (!item) return missing(res);
            if (item.lock_version !== version) return conflict(req, res, 'stale', true);
        }
        const { values, errors, fields } = itemInput(req.body, await store.listUnits());
        if (Object.keys(errors).length) {
            return detail(req, res, { values, errors, editId: req.itemId, fragment: true, status: 422 });
        }
        const outcome = req.itemId
            ? await store.updateItem(buyerId, rfqId, req.itemId, version, fields)
            : await store.addItem(buyerId, rfqId, fields);
        if (outcome !== 'saved') return conflict(req, res, outcome, true);
        return itemSaved(req, res, req.itemId ? 'Material updated.' : 'Material added.');
    }

    function itemSaved(req, res, notice) {
        if (req.get('HX-Request') !== 'true') return res.redirect(303, `${req.rfqPath}#rfq-items`);
        return detail(req, res, { fragment: true, notice });
    }

    router.post('/:rfqId/items', saveItem);
    router.post('/:rfqId/items/:itemId/edit', saveItem);
    router.post('/:rfqId/items/:itemId/delete', async (req, res) => {
        const outcome = await store.deleteItem(buyerId, req.rfq.rfq_id, req.itemId, positiveId(req.body?.lock_version));
        if (outcome !== 'saved') return conflict(req, res, outcome, true);
        return itemSaved(req, res, 'Material removed.');
    });

    return router;
}

module.exports = { createRfqRouter };
