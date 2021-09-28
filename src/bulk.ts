import fs from "fs";
import { TransformOptions } from "stream";
import csv from "csv-parser";
import BigPicture from "bigpicture-node";
import Bottleneck from "bottleneck";
import { Transform, transforms } from "json2csv";
import JSON2CSVTransform from "json2csv/JSON2CSVTransform";
import Debug from "debug";
import { Client as BigPictureClient } from "bigpicture-node/dist/client";

const debug = Debug("bulk_enrich:debug");
const trace = Debug("bulk_enrich:trace");

interface Record {
  domain: string;
}

export interface BulkEnrichConfig {
  API_KEY: string;
  inputFile: string;
  outputFile: string;
  maxConcurrent: number;
}

export class BulkEnricher {
  _config: BulkEnrichConfig;
  count: number;

  bigPicture: BigPictureClient;
  limiter: Bottleneck;

  readable: NodeJS.ReadableStream;
  json2csv: JSON2CSVTransform<Record>;

  constructor(config: BulkEnrichConfig) {
    this._config = Object.assign({ maxConcurrent: 600 }, config);
    this._config.outputFile = this._config.outputFile || this._buildOutputFile(this._config.inputFile);

    if (!this._config.API_KEY) {
      throw Error("API_KEY missing from config");
    }
    if (!this._config.inputFile) {
      throw Error("inputFile missing from config");
    }
    if (!this._config.outputFile) {
      throw Error("outputFile missing from config");
    }
    if (!this._config.maxConcurrent) {
      throw Error("maxConcurrent cannot be undefined");
    }

    this.bigPicture = BigPicture(config.API_KEY);
    this.count = 0;
  }

  _buildOutputFile(inputFile: string) {
    if (!inputFile) {
      throw Error("inputFile missing from config");
    }

    return inputFile.replace('.csv', '-output.csv');
  }

  /**
   * Init Limiter
   */
  initLimiter() {
    this.limiter = new Bottleneck({
      maxConcurrent: this._config.maxConcurrent,
      reservoir: this._config.maxConcurrent, // initial value
      reservoirRefreshAmount: this._config.maxConcurrent,
      reservoirRefreshInterval: 60 * 1000, // must be divisible by 250
    });

    this.limiter.on("error", function (error) {
      debug("Limiter Error: ", error);
    });

    // This will be called every time a job is retried.
    this.limiter.on("retry", function (message, jobInfo) {
      const id = jobInfo.options.id;
      debug("Retry:", message, jobInfo);

      // Here we retry twice
      if (jobInfo.retryCount <= 1) {
        debug(`Retrying job ${id} in 1m!`);
        return 60000;
      }
    });
  }

  /**
   * Create Read Stream
   */
  createReader() {
    this.readable = fs
      .createReadStream(this._config.inputFile)
      .pipe(csv({ separator: ",", headers: ["domain"] }));
  }

  /**
   * Create Write Stream
   */
  createWriter() {
    const _transforms = [transforms.flatten()];
    const opts = { transforms: _transforms };
    const transformOpts: TransformOptions = {
      encoding: "utf-8",
      objectMode: true,
    };

    this.json2csv = new Transform(opts, transformOpts);
    this.json2csv.pipe(fs.createWriteStream(this._config.outputFile));
  }

  /**
   * Make Request
   *
   * @param domain
   * @returns
   */
  async makeRequest(domain: string) {
    if (!domain) {
      throw new Error("No id provided");
    }

    let data;
    try {
      data = await this.bigPicture.Company.find({ domain: domain });
    } catch (err: any) {
      switch (err.type) {
        case "not_found":
          return null;
        default:
          throw err;
      }
    }

    return data;
  }

  /**
   * Process Row
   *
   * @param row
   */
  async processRow(row: Record) {
    let result;
    try {
      const counts = this.limiter.counts();
      if (
        counts.RECEIVED >= this._config.maxConcurrent ||
        counts.RUNNING >= this._config.maxConcurrent
      ) {
        this.readable.pause();
      }
      result = await this.limiter.schedule(() => this.makeRequest(row.domain));
      if (!result) {
        throw new Error(`Not found: ${row.domain}`);
      }
      result.lookup_domain = row.domain;

      this.json2csv.write(result);
    } catch (err) {
      debug("Lookup Error: ", err, row);

      this.json2csv.write({ lookup_domain: row.domain });
    } finally {
      if (this.readable.isPaused()) {
        this.readable.resume();
      }

      this.count++;
      trace("Processed: ", this.count);
    }
  }

  /**
   * Start
   *
   * @returns
   */
  async start() {
    this.initLimiter();
    this.createReader();
    this.createWriter();

    return new Promise((resolve, reject) => {
      this.readable.on("data", this.processRow.bind(this));
      this.readable.on("error", reject);
      this.readable.on("end", resolve);
    });
  }
}
