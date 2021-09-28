BigPicture Bulk Company Enrichment
==================================

The project uses the [BigPicture API](https://bigpicture.io/docs/api/) via the [BigPicture Node SDK](https://www.npmjs.com/package/bigpicture-node) to enrich a list of domains with company data including company name, industry, employee count, and [more](https://bigpicture.io/docs/api/#attributes).

It's designed to handle CSV files of any size, rate limiting, and retries.

## Installation

This project requires Node.js v8.x or greater.

Clone the repo
```bash
git clone git@github.com:bigpictureio/bigpicture-bulk-enrichment.git
```

Install dependencies and build project.
```bash
npm install
npm run build
```

## Usage

Your input file should be a CSV without a header and the first column being the domains you would like to enrich.

Example:

```
uber.com
microsoft.com
stripe.com
```

Start the enrichment via the following command. Be sure to pass in your BigPicture API Key. 

```bash
API_KEY=YOUR_API_KEY INPUT_FILE="domains.csv" node run.js
```

If you don't have an API Key, you can sign up for a free one at https://bigpicture.io.

NOTE: Depending on how big your list is and if the record is already in our system or not, this may take some time to run.

## Need Help?
If you need a higher quota, increased rate limit, or have any questions, you can reach out to us at support@bigpicture.io.

