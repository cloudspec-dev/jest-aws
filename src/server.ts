
import { CloudWatchLogsClient, FilteredLogEvent, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { XRayClient, BatchGetTracesCommand } from '@aws-sdk/client-xray';
import bodyParser from 'body-parser';
import colors from 'colors/safe';
import express from 'express';
import winston from 'winston';
import { LambdaSegment, Segments } from './xray-types';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ tags, message }) => {
      if (tags) {
        return `\r\n\r\n${colors.cyan(tags.join(' > '))}\r\n ${message}\r\n`;
      } else {
        return message;
      }
    }),
  ),
  defaultMeta: { service: 'aws' },
  transports: [
    new winston.transports.Console({ level: 'debug' }),
  ],
});

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const xrayClient = new XRayClient({ region: 'us-east-1' });

const queryLogs = async (client: CloudWatchLogsClient, document: LambdaSegment): Promise<FilteredLogEvent[]> => {
  const { trace_id, name } = document;
  const { request_id } = document.aws;

  const logGroupName = `/aws/lambda/${name}`;

  const command = new FilterLogEventsCommand({
    logGroupName: logGroupName,
    startTime: (document.start_time * 1000) - 30000,
    endTime: (document.end_time * 1000) + 30000,
    filterPattern: `?"${request_id}" ?"${trace_id}"`,
    limit: 100,
  });

  const results = await client.send(command);
  if (!results.events) {
    throw new Error('nothing found');
  }

  return results.events;
  // } else {
  //   let results: FilteredLogEvent[] = [];

  //   for (const subsegment of document.subsegments) {
  //     console.log({ subsegment, aws: subsegment.aws, sub: (subsegment as any).subsegments });
  //     const { trace_id } = document;
  //     const { request_id } = subsegment.aws;

  //     const logGroupNames = document.aws.resource_names.map(r => `/aws/lambda/${r}`);

  //     const command = new FilterLogEventsCommand({
  //       logGroupName: logGroupNames[0],
  //       startTime: (document.start_time * 1000) - 30000,
  //       endTime: (document.end_time * 1000) + 30000,
  //       filterPattern: `?"${request_id}" ?"${trace_id}"`,
  //       limit: 100,
  //     });

  //     const events = (await client.send(command)).events;
  //     if (events) {
  //       results = [...results, ...events];
  //     }
  //   }

  //   if (results.length === 0) {
  //     throw new Error('nothing found');
  //   }

  //   return results;
  // }
};

const logTrace = async (data: Data) => {
  logger.info(`fetching traces (${data.traceId}) for ${data.currentTestName}...`, { tags: [data.path] });
  // should probably be something like an exponential backoff - 4000ms seems to work in most cases for now
  await sleep(4000);

  const command = new BatchGetTracesCommand({
    TraceIds: [data.traceId],
  });
  const result = await xrayClient.send(command);

  for (const trace of result.Traces || []) {
    for (const segment of trace.Segments || []) {
      const document = JSON.parse(segment.Document || '{}') as Segments;

      switch (document.origin) {
        case 'AWS::Lambda': {
          const logsClient = new CloudWatchLogsClient({ region: document.aws.region || 'us-east-1' });
          let count = 0;
          const getLogs = async (): Promise<any[]> => {
            count++;
            const logs = await queryLogs(logsClient, document);
            if (logs.length === 0 && count < 5) {
              console.log(logs);
              await sleep(1000);
              logger.debug('refetching logs...', { tags: [data.path] } );
              return getLogs();
            } else {
              return logs;
            }
          };
          const logs = await getLogs();
          // print all messages at once and get rid of whitespace characters (i.e. newlines)
          const messages = logs.map(l => l.message.replace(/^\s+|\s+$/g, ''));
          const url = `https://console.aws.amazon.com/xray/home?region=${document.aws.region}#/traces/${document.trace_id}`;
          logger.info(messages.join('\r\n'), { tags: [data.path, data.currentTestName, url] });
        }
      }
    }
  }
};

interface Data {
  traceId: string;
  currentTestName: string;
  segmentName: string;
  path: string;
}
const app = express();
app.use(bodyParser.json());

const port = 9000;

app.get('/', (_req, res) => {
  res.send('Hello World!');
});

app.post('/data', async (req, res) => {
  const body = req.body as Data;
  void logTrace(body);
  res.status(201).send();
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});