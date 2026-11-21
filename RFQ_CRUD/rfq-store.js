const { randomBytes } = require('node:crypto');

const buyerScope = `r.created_by_user_id = ? AND (
    r.jobsite_id IS NULL OR EXISTS (
        SELECT 1 FROM buyer_jobsite AS b
        WHERE b.buyer_id = r.created_by_user_id AND b.jobsite_id = r.jobsite_id
    )
)`;

function createRfqStore(pool) {
    async function rows(sql, params = [], connection = pool) {
        const [result] = await connection.execute(sql, params);
        return result;
    }

    async function getRfq(buyerId, rfqId, connection = pool, lock = false) {
        const [rfq] = await rows(`SELECT r.*, j.site_name
            FROM rfq AS r LEFT JOIN jobsite AS j ON j.jobsite_id = r.jobsite_id
            WHERE ${buyerScope} AND r.rfq_id = ? ${lock ? 'FOR UPDATE OF r' : ''}`,
        [buyerId, rfqId], connection);
        return rfq;
    }

    async function writeDraft(buyerId, rfqId, write) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // All changes under the same RFQ take this lock, including item inserts and RFQ deletion.
            const rfq = await getRfq(buyerId, rfqId, connection, true);
            const outcome = !rfq ? 'missing' : rfq.status !== 'DRAFT' ? 'locked' : await write(rfq, connection);
            await connection.commit();
            return outcome;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    return {
        getRfq,
        listRfqs(buyerId) {
            return rows(`SELECT r.rfq_id, r.rfq_number, r.status, r.created_at, j.site_name,
                    (SELECT COUNT(*) FROM rfq_item AS i WHERE i.rfq_id = r.rfq_id) AS item_count
                FROM rfq AS r LEFT JOIN jobsite AS j ON j.jobsite_id = r.jobsite_id
                WHERE ${buyerScope} ORDER BY r.rfq_id DESC`, [buyerId]);
        },
        listSites(buyerId) {
            return rows(`SELECT j.jobsite_id, j.site_name FROM jobsite AS j
                JOIN buyer_jobsite AS b ON b.jobsite_id = j.jobsite_id
                WHERE b.buyer_id = ? ORDER BY j.site_name`, [buyerId]);
        },
        listUnits() {
            return rows('SELECT unit_id, unit_code FROM unit ORDER BY unit_code');
        },
        async addRfq(buyerId, fields) {
            const number = `RFQ-${randomBytes(8).toString('hex').toUpperCase()}`;
            const result = await rows(`INSERT INTO rfq (rfq_number, created_by_user_id, jobsite_id,
                delivery_address_text, requested_delivery_start, requested_delivery_end) VALUES (?, ?, ?, ?, ?, ?)`,
            [number, buyerId, ...fields]);
            return result.insertId;
        },
        updateRfq(buyerId, rfqId, version, fields) {
            return writeDraft(buyerId, rfqId, async (rfq, connection) => {
                if (rfq.lock_version !== version) return 'stale';
                await rows(`UPDATE rfq SET jobsite_id = ?, delivery_address_text = ?, requested_delivery_start = ?,
                    requested_delivery_end = ?, lock_version = lock_version + 1 WHERE rfq_id = ?`,
                [...fields, rfqId], connection);
                return 'saved';
            });
        },
        deleteRfq(buyerId, rfqId, version) {
            return writeDraft(buyerId, rfqId, async (rfq, connection) => {
                if (rfq.lock_version !== version) return 'stale';
                await rows('DELETE FROM rfq WHERE rfq_id = ?', [rfqId], connection);
                return 'saved';
            });
        },
        listItems(rfqId) {
            return rows(`SELECT i.*, u.unit_code FROM rfq_item AS i
                LEFT JOIN unit AS u ON u.unit_id = i.unit_id WHERE i.rfq_id = ? ORDER BY i.line_no`, [rfqId]);
        },
        addItem(buyerId, rfqId, fields) {
            return writeDraft(buyerId, rfqId, async (_rfq, connection) => {
                const [next] = await rows('SELECT COALESCE(MAX(line_no), 0) + 1 AS line_no FROM rfq_item WHERE rfq_id = ?',
                    [rfqId], connection);
                await rows(`INSERT INTO rfq_item (rfq_id, line_no, material_name, specification_text, requested_quantity, unit_id)
                    VALUES (?, ?, ?, ?, ?, ?)`, [rfqId, next.line_no, ...fields], connection);
                return 'saved';
            });
        },
        updateItem(buyerId, rfqId, itemId, version, fields) {
            return writeDraft(buyerId, rfqId, async (_rfq, connection) => {
                const result = await rows(`UPDATE rfq_item SET material_name = ?, specification_text = ?, requested_quantity = ?,
                    unit_id = ?, lock_version = lock_version + 1 WHERE rfq_id = ? AND rfq_item_id = ? AND lock_version = ?`,
                [...fields, rfqId, itemId, version], connection);
                return result.affectedRows ? 'saved' : 'stale';
            });
        },
        deleteItem(buyerId, rfqId, itemId, version) {
            return writeDraft(buyerId, rfqId, async (_rfq, connection) => {
                const result = await rows('DELETE FROM rfq_item WHERE rfq_id = ? AND rfq_item_id = ? AND lock_version = ?',
                    [rfqId, itemId, version], connection);
                return result.affectedRows ? 'saved' : 'stale';
            });
        },
    };
}

module.exports = { createRfqStore };
