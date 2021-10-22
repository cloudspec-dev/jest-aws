
export type Segments =
  | LambdaSegment

export interface LambdaSegment {
  id:          string;
  name:        string;
  start_time:  number;
  trace_id:    string;
  end_time:    number;
  parent_id:   string;
  aws:         LambdaSegmentAws;
  annotations: Annotations;
  service:     Service;
  origin:      'AWS::Lambda';
  subsegments: Subsegment[];
}

export interface Annotations {
  [key: string]: string
}

export interface LambdaSegmentAws {
  account_id:     string;
  function_arn:   string;
  xray:           Xray;
  region:         string;
  request_id:     string;
  resource_names: string[];
}

export interface Xray {
  package:     string;
  sdk_version: string;
  sdk:         string;
}

export interface Service {
  name:            string;
  version:         string;
  runtime:         string;
  runtime_version: string;
}

export interface Subsegment {
  id:         string;
  name:       string;
  start_time: number;
  end_time:   number;
  http:       HTTP;
  aws:        SubsegmentAws;
  namespace:  string;
}

export interface SubsegmentAws {
  retries:    number;
  region:     string;
  operation:  string;
  request_id: string;
}

export interface HTTP {
  response: Response;
}

export interface Response {
  status: number;
}
