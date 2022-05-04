import * as AWS from "aws-sdk";
import * as yargs from "yargs";
import * as fs from "fs";

AWS.config.update({
  region: "eu-north-1",
});
const glueClient = new AWS.Glue();
const docClient = new AWS.DynamoDB.DocumentClient();

const runCrawler = async (crawlerName?: string) => {
  if (!crawlerName) {
    throw '"crawlerName" argument is needed';
  }
  return glueClient.startCrawler({ Name: crawlerName }).promise();
};

const checkGlueTables = async (glueDatabaseName?: string) => {
  if (!glueDatabaseName) {
    throw '"glueDatabaseName" argument is needed';
  }
  const res = await glueClient
    .getTables({ DatabaseName: glueDatabaseName })
    .promise();
  return res.TableList;
};

const getGlueTableName = async (glueDatabaseName?: string) => {
  if (!glueDatabaseName) {
    throw '"glueDatabaseName" argument is needed';
  }
  const tables = await checkGlueTables(glueDatabaseName);
  return (tables || []).pop()?.Name;
};

const createScript = async (
  scriptFileName: string,
  glueDatabaseName?: string,
  glueTableName?: string,
  s3TargetPath?: string
) => {
  if (!glueDatabaseName || !glueTableName || !s3TargetPath) {
    throw '"glueDatabaseName", "glueTableName" and "s3TargetPath" arguments are needed';
  }
  const scriptRes = await glueClient
    .createScript({
      DagEdges: [
        {
          Source: "source_node",
          Target: "target_node",
        },
      ],
      DagNodes: [
        {
          Args: [
            {
              Name: "database",
              // The strings have to have quotes because the createScript API inputs them to script without quotes,
              // producing invalid Python script. Yes, really
              // Either I'm using it somehow wrong or it's a bug in the API
              Value: `"${glueDatabaseName}"`,
            },
            {
              Name: "table_name",
              Value: `"${glueTableName}"`,
            },
          ],
          Id: "source_node",
          NodeType: "DataSource",
        },
        {
          Args: [
            {
              Name: "connection_type",
              Value: '"s3"',
            },
            {
              Name: "connection_options",
              Value: `{ "path": "${s3TargetPath}", "partitionKeys": [] }`,
            },
            {
              Name: "format",
              Value: '"glueparquet"',
            },
          ],
          Id: "target_node",
          NodeType: "DataSink",
        },
      ],
      Language: "PYTHON",
    })
    .promise();

  const script = scriptRes.PythonScript;

  fs.writeFileSync(scriptFileName, script, "utf8");
  return;
};

const loadData = async (tableName?: string) => {
  if (!tableName) {
    throw '"tableName" argument is needed';
  }
  const url =
    "https://sis-tuni.funidata.fi/kori/api/module-search?curriculumPeriodId=uta-lvv-2021&universityId=tuni-university-root-id&moduleType=DegreeProgramme&limit=1000";
  const res = await fetch(url);
  const data = await res.json();

  const courseItems = data.searchResults.map((course: any) => ({
    PK: course.id,
    Code: course.code,
    Lang: course.lang,
    GroupId: course.groupId,
    Name: course.name,
    MinCredits: course.credits.min,
  }));

  const puts = courseItems.map((item: any) =>
    docClient
      .put({
        TableName: tableName,
        Item: item,
      })
      .promise()
  );

  return Promise.all(puts);
};

const runETLjob = async (jobName?: string) => {
  if (!jobName) {
    throw '"jobName" argument is needed';
  }

  return glueClient
    .startJobRun({
      JobName: jobName,
    })
    .promise();
};

(async () => {
  // TODO proper CLI tool
  const args = yargs(process.argv.slice(2)).options({
    crawlerName: { type: "string", demandOption: false },
    tableName: { type: "string", demandOption: false },
    glueDatabaseName: { type: "string", demandOption: false },
    s3TargetBucketName: { type: "string", demandOption: false },
    glueTableName: { type: "string", demandOption: false },
    jobName: { type: "string", demandOption: false },
  }).argv;
  console.log("args", args);

  if (args._[0] === "runCrawler") {
    await runCrawler(args.crawlerName);
    return console.log("Crawler started");
  }
  if (args._[0] === "loadData") {
    await loadData(args.tableName);
    return console.log("Loaded example data");
  }
  if (args._[0] === "getTableNames") {
    const names = await checkGlueTables(args.glueDatabaseName);
    console.log("Glue tables in database", names);
  }
  if (args._[0] === "createScript") {
    const scriptPath = "lib/glueETLScript.py";
    await createScript(
      scriptPath,
      args.glueDatabaseName,
      args.glueTableName ||
        (await getGlueTableName(args.glueDatabaseName)) ||
        "",
      `s3://${args.s3TargetBucketName}/`
    );
    return console.log(`Script created and written into ${scriptPath}`);
  }
  if (args._[0] === "runETLjob") {
    const res = await runETLjob(args.jobName);
    return console.log("Started ETL job");
  }

  return;
})();
