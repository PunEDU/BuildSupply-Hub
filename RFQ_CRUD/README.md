# Assignment 4 · Contractor RFQs

The Contractor RFQs page supports two CRUD workflows for Assignment 4. Contractors can manage requests for quotation (`rfq`) and the material lines within each request (`rfq_item`). The local review app uses a dedicated MySQL database named `buildsupply_assignment4`, with sample jobsites and units.

## Implementation plan

1. **RFQs.** Provide pages to list, create, view, and edit RFQs. Ask for confirmation before deleting a draft. Use an Express router, a shared Handlebars layout, and POST forms as shown in Labs 5–7.
2. **Material lines.** Put the material table and form on the RFQ detail page, following the master–detail example in Lecture 10. Use HTMX to refresh the Materials section after a change. Standard POST forms also work with JavaScript disabled.
3. **Persistence and verification.** Use prepared statements with `mysql2`, and style the pages with Bootstrap for desktop and mobile. Test the HTTP routes against MySQL, including attempts to edit sent RFQs and simultaneous material inserts.

See `10_Web-3.pdf` (Lecture 10, pages 4–7) and `lab-1104.pdf` (Labs 5–7, pages 20–35) in the course materials.

## Run locally

Use Node.js 22.21 or later and start Docker Desktop. Run the following commands in PowerShell from the `RFQ_CRUD` folder.

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd ci
docker compose up -d --wait
npm.cmd start
```

Open the [RFQs page](http://127.0.0.1:3104/contractor/rfqs). To run the HTTP and MySQL integration tests, run `npm.cmd test` in another PowerShell window. The tests create and clean up their own records.

MySQL listens at `127.0.0.1:33074` and stores its data in a Docker volume. Use `docker compose stop` to stop MySQL and `docker compose up -d --wait` to restart it. Docker runs `sql/schema.sql` when it initializes the volume.

## Manual review

1. Select **Create RFQ**, then **Save draft** with the fields empty. Return to **All RFQs** and reopen the draft.
2. Select **Edit RFQ**. Choose `Riverside Renovation` as the jobsite and enter `North gate` as the delivery address. Try a delivery end time earlier than the start, check the validation message, then correct the times and save.
3. In **Materials**, add `Portland cement` with specification `Type I`, quantity `30`, and unit `Bag`. The table should update on the same page. Refresh to confirm the material was saved to MySQL.
4. Select **Edit** on the material row, change the quantity to `35`, and select **Save material**. Select **Remove** and check that the row disappears.
5. Add a material, then select **Delete this draft** and **Confirm delete draft**. The app returns to the RFQ list and removes the draft along with its material lines.

## Data rules and scope

- A draft may have zero material lines, as specified by D28 (US03) in Requirements and System Design. The first-save jobsite requirement is still open in the design, so the local app lets contractors choose a jobsite later.
- RFQs and their materials are editable and deletable only while the RFQ is in `DRAFT`. Users with access can still view RFQs in other statuses.
- Material saves validate the name, quantity, and unit. The `lock_version` field protects against overwrites from stale forms. Locking the parent RFQ in a transaction gives simultaneous material inserts distinct line numbers and coordinates them with RFQ deletion.
- The review app runs on `127.0.0.1` with a demo contractor. To integrate `routes/rfqs.js` into the team website, use the authenticated contractor's identity and the team's authorization tables. Sending RFQs to suppliers is a later project step.
