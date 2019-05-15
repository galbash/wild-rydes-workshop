const AWS = require('aws-sdk');
const uuid = require('uuid');

const ddb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const PAY_PER_RIDE = 13;

exports.handler = async (event, context) => {
  // Log the event argument for debugging and for use in local development.
  console.log(JSON.stringify(event, undefined, 2));

  const scanParams = {
    TableName: process.env.TABLE_NAME,
    FilterExpression: "#counter > :base",
    ExpressionAttributeNames: { '#counter': 'RideCount' },
    ExpressionAttributeValues: { ':base': 0 }
  };

  const scanResult = await ddb.scan(scanParams).promise();
  console.log(scanResult.Items);

  await Promise.all(scanResult.Items.map(handleItem));
};

async function handleItem(item) {
  await generateSalary(item);
  await decreaseRides(item);
}

async function generateSalary(item) {
  await s3.putObject({
    Bucket: process.env.BUCKET_NAME,
    Key: `${item.Name}/${uuid.v4()}`,
    Tagging: `email=${item.Name}%40wildrydes.corn&subject=${item.Name}%20Rides%20Paycheck`,
    Body: (
      `
Paycheck for ${item.Name}
-----------------------------------
Time: ${(new Date()).toISOString()}
Rides: ${item.RideCount}
Total Amount: ${item.RideCount * PAY_PER_RIDE} USD

WildRydes corp.
`
    )
  }).promise();
}

async function decreaseRides(item) {
  const params = {
    TableName: process.env.TABLE_NAME,
    Key: { Name: item.Name },
    UpdateExpression: "ADD #counter :decrement",
    ExpressionAttributeNames: { '#counter': 'RideCount' },
    ExpressionAttributeValues: { ':decrement': -(item.RideCount) }
  };

  await ddb.update(params).promise();
}