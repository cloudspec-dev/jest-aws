// inspired by
// - https://github.com/doctolib/jest-os-detection/blob/cc661114ccecaff5c9328e0a15fe6d819f665971/src/patch-jest.ts

import type { Global } from '@jest/types';
import AWSXRay from 'aws-xray-sdk';
import got from 'got';

type Global = Global.Global;

// should be configurable or from env
const url = 'http://localhost:9000/data';
const region = 'us-east-1';
const testContext = 'appName';

const install = (
  g: Global,
) => {
  AWSXRay.enableAutomaticMode();
  const namespace = AWSXRay.getNamespace();

  const bind = (t: Global.EachTestFn<Global.PromiseReturningTestFn>) => {
    return namespace.bind(async (...args: any) => {
      const { currentTestName, testPath } = expect.getState();

      // see for valid characters https://docs.aws.amazon.com/xray/latest/devguide/xray-api-segmentdocuments.html#api-segmentdocuments-fields
      const invalidCharacters = /[^a-zA-Z0-9.:/%&#=+\-@\s]/g;
      const segmentName = currentTestName.replace(invalidCharacters, '');
      const relativePath = testPath.replace(process.cwd(), '');

      const segment = new AWSXRay.Segment(segmentName);
      segment.addAnnotation('testPath', relativePath);
      segment.addAnnotation('testName', currentTestName);
      segment.addAnnotation('testContext', testContext);
      AWSXRay.setSegment(segment);
      try {
        await t(...args);
      } catch (e) {
        segment.addError(e as string);
        throw (e);
      } finally {
        segment.close();
        try {
          await got.post(url, {
            json: {
              traceId: segment.trace_id,
              currentTestName,
              segmentName,
              path: relativePath,
            },
          });
        } catch (e) {
          console.log({ e });
        }
        console.log(`segment: https://console.aws.amazon.com/xray/home?region=${region}#/traces/${segment.trace_id}`);
      }
    });
  };

  const test = (
    title: string,
    t: Global.EachTestFn<Global.PromiseReturningTestFn>,
    timeout?: number,
  ) => {
    g.test(title, bind(t), timeout);
  };

  const it = (
    title: string,
    t: Global.EachTestFn<Global.PromiseReturningTestFn>,
    timeout?: number,
  ) => {
    g.it(title, bind(t), timeout);
  };

  // test.skip = bind(g.test.skip)(table, ...data);
  // test.only = bind(g.test.only)(table, ...data);

  return { test, it };
};

export const xray = install(global as unknown as Global);