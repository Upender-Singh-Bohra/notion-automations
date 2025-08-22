import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config();

// Setup Notion client with your integration token
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_TODOS_DATABASE_ID;

function getTodayIST() {
  const now = new Date();

  // IST offset is UTC +5:30 in minutes
  const istOffset = 5.5 * 60;

  // Convert current UTC time to IST
  const istTime = new Date(now.getTime() + istOffset * 60 * 1000);

  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istTime.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Get all tasks for today
async function getTasksForToday() {
  const today = getTodayIST();

  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        {
          property: "Date",
          date: {
            equals: today,
          },
        },
        {
          property: "Time of Day",
          status: {
            does_not_equal: "Paused",
          },
        },
        {
          property: "Done ?",
          checkbox: {
            equals: false,
          },
        },
      ],
    },
  });

  return response.results;
}

async function updateTaskStatus(task) {
  const taskId = task.id;
  const currentStatus = task.properties["Time of Day"].status?.name;
  const originalStatus = task.properties["Original Status"].number || null;

  const validStatuses = [1, 2, 3];
  const isValidOriginal = validStatuses.includes(originalStatus);

  // Compute new statusCode if needed
  let statusCode = originalStatus || 0;
  if (!statusCode) {
    if (currentStatus === "morning") statusCode = 1;
    else if (currentStatus === "afternoon") statusCode = 2;
    else if (currentStatus === "evening") statusCode = 3;
  }

  // Build update payload
  const propertiesToUpdate = {};

  if ((originalStatus === null || !isValidOriginal) && statusCode > 0) {
    propertiesToUpdate["Original Status"] = { number: statusCode };
  }

  if (currentStatus === "afternoon") {
    propertiesToUpdate["Time of Day"] = {
      status: { name: "evening" },
    };
  }

  // Send a single update call if needed
  if (Object.keys(propertiesToUpdate).length > 0) {
    await notion.pages.update({
      page_id: taskId,
      properties: propertiesToUpdate,
    });
  }

  if (originalStatus === null) {
    console.log(
      `Preserved Original Status for task ${taskId} (status: ${currentStatus})`
    );
  } else if (!isValidOriginal) {
    console.log(
      `Corrected invalid Original Status for task ${taskId} → ${statusCode}`
    );
  }

  if (currentStatus === "afternoon") {
    console.log(`Updated task ${taskId} from afternoon → evening`);
  }
}

async function run() {
  try {
    const tasks = await getTasksForToday();
    console.log(`Found ${tasks.length} active tasks for today.`);

    for (const task of tasks) {
      await updateTaskStatus(task);
    }

    console.log("✅ Done processing today's tasks.");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

run();
