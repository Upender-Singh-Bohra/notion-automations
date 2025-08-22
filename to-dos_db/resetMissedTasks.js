import { Client } from "@notionhq/client";

import dotenv from "dotenv";
dotenv.config();

// Notion client Setup with integration token
const notion = new Client({ auth: process.env.NOTION_TOKEN });

const databaseId = process.env.NOTION_TODOS_DATABASE_ID;

// Helper to get today's date in IST (Indian Standard Time) as YYYY-MM-DD
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

async function getTasksToUpdate() {
  const today = getTodayIST();
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        {
          property: "Date",
          date: {
            before: today,
          },
        },
        {
          property: "Done ?",
          checkbox: {
            equals: false,
          },
        },
        {
          property: "Time of Day",
          status: {
            does_not_equal: "Paused",
          },
        },
      ],
    },
  });
  return response.results;
}

async function restoreUnfinishedTask(task) {
  const taskId = task.id;
  const originalStatus = task.properties["Original Status"].number || null;
  const currentStatus = task.properties["Time of Day"]?.status?.name;
  const today = getTodayIST();
  console.log(today);

  const propertiesToUpdate = {
    Date: {
      date: { start: today },
    },
  };

  let restoreStatus = null;

  if (originalStatus === 1) restoreStatus = "morning";
  else if (originalStatus === 2) restoreStatus = "afternoon";
  else if (originalStatus === 3) restoreStatus = "evening";

  if (restoreStatus) {
    propertiesToUpdate["Time of Day"] = { status: { name: restoreStatus } };
  } else {
    // Correct invalid "Original Status" using current status of the task
    if (currentStatus === "morning") {
      propertiesToUpdate["Original Status"] = { number: 1 };
    } else if (currentStatus === "afternoon") {
      propertiesToUpdate["Original Status"] = { number: 2 };
    } else if (currentStatus === "evening") {
      propertiesToUpdate["Original Status"] = { number: 3 };
    }
  }

  // Update first
  await notion.pages.update({
    page_id: taskId,
    properties: propertiesToUpdate,
  });

  // Log after successful update
  if (restoreStatus) {
    console.log(
      `Reset task ${taskId} → date updated to today & restored to original status (${restoreStatus})`
    );
  } else if (currentStatus) {
    console.log(
      `Corrected invalid Original Status for task ${taskId} → set based on current "${currentStatus}"`
    );
  } else {
    console.log(
      `Reset task ${taskId} → date updated to today, status unchanged`
    );
  }
}

async function run() {
  try {
    const tasks = await getTasksToUpdate();
    console.log(`Found ${tasks.length} tasks to update.`);
    for (const task of tasks) {
      await restoreUnfinishedTask(task);
    }
    console.log("✅ Done restoring tasks.");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

run();
