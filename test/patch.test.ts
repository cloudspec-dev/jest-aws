import AWSXRay from 'aws-xray-sdk';
import { xray } from '../src';

describe('X-Ray Traces', () => {
  describe('for "it"', () => {
    xray.it('it with xray', () => {
      expect(1).toBe(1);
    });

    xray.it('it with xray sub segment', () => {
      const subSegment = AWSXRay.getSegment()!.addNewSubsegment('to be');
      expect(1).toBe(1);
      subSegment.close();
    });
  });
});