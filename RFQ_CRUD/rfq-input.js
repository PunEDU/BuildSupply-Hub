function readFields(body, names) {
    return Object.fromEntries(names.map(name => [name, typeof body?.[name] === 'string' ? body[name].trim() : '']));
}

function positiveId(value) {
    return typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 4294967295
        ? Number(value)
        : null;
}

function validLocalDate(value) {
    if (!/^[1-9]\d{3}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return false;
    const date = new Date(`${value}:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === value;
}

function rfqInput(body, sites) {
    const values = readFields(body, [
        'jobsite_id', 'delivery_address_text', 'requested_delivery_start', 'requested_delivery_end',
    ]);
    const errors = {};
    const siteId = positiveId(values.jobsite_id);
    if (values.jobsite_id && !sites.some(site => site.jobsite_id === siteId)) {
        errors.jobsite_id = 'Choose an available jobsite.';
    }
    if ([...values.delivery_address_text].length > 255) {
        errors.delivery_address_text = 'Use 255 characters or fewer.';
    }
    const { requested_delivery_start: start, requested_delivery_end: end } = values;
    if (start && !validLocalDate(start)) errors.requested_delivery_start = 'Enter a valid start date and time.';
    if (end && !validLocalDate(end)) errors.requested_delivery_end = 'Enter a valid end date and time.';
    if (start && end && !errors.requested_delivery_start && !errors.requested_delivery_end && end < start) {
        errors.requested_delivery_end = 'The delivery end must be on or after the start.';
    }
    return {
        values,
        errors,
        fields: [siteId, values.delivery_address_text || null, start || null, end || null],
    };
}

function itemInput(body, units) {
    const values = readFields(body, ['material_name', 'specification_text', 'requested_quantity', 'unit_id']);
    const errors = {};
    if (!values.material_name || [...values.material_name].length > 120) {
        errors.material_name = 'Enter a material name of 1 to 120 characters.';
    }
    if ([...values.specification_text].length > 500) {
        errors.specification_text = 'Use 500 characters or fewer.';
    }
    const quantity = values.requested_quantity;
    if (quantity && (!/^\d{1,10}(\.\d{1,4})?$/.test(quantity) || Number(quantity) <= 0)) {
        errors.requested_quantity = 'Enter a positive quantity with up to 10 whole digits and 4 decimal places.';
    }
    const unitId = positiveId(values.unit_id);
    if (values.unit_id && !units.some(unit => unit.unit_id === unitId)) {
        errors.unit_id = 'Choose an available unit.';
    }
    return {
        values,
        errors,
        fields: [values.material_name, values.specification_text || null, quantity || null, unitId],
    };
}

module.exports = { positiveId, rfqInput, itemInput };
