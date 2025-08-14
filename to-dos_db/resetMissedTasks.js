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

// Update the "Date" property to today
async function updateTaskDate(pageId) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Date: {
        date: {
          start: getTodayIST(),
        },
      },
    },
  });
}

async function run() {
  try {
    console.log(getTodayIST());
    const tasks = await getTasksToUpdate();
    console.log(`Found ${tasks.length} tasks to update.`);
    for (const task of tasks) {
      await updateTaskDate(task.id);
      console.log(`Updated task: ${task.id}`);
    }
    console.log("✅ Done updating tasks.");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

run();
