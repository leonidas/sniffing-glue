#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { createStack } from "../lib/infra-stack";
import * as AWS from "aws-sdk";

AWS.config.update({
  region: "eu-north-1",
});

const main = () => {
  const app = new cdk.App();
  cdk.Tags.of(app).add("Project", "SniffingGlue");
  cdk.Tags.of(app).add("TEST", "REMOVE IF YOU SEE THIS");

  createStack(app, "InfraStack", {
    companyName: "cirit",
    projectName: "sniffing-glue",
  });
};

main();
