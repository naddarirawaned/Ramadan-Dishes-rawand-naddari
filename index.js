const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
const port = 3000;

const dishesData = require("./dishes.json");

let prayerTimes;
let prayerTimesLoaded = false;

async function fetchPrayerTimes() {
  try {
    const marchResponse = await axios.get(
      "http://api.aladhan.com/v1/calendar/2024/3?latitude=21.4225&longitude=39.8262&method=0"
    );
    const aprilResponse = await axios.get(
      "http://api.aladhan.com/v1/calendar/2024/4?latitude=21.4225&longitude=39.8262&method=0"
    );

    const marchData = marchResponse.data.data;
    const aprilData = aprilResponse.data.data;
    const combinedData = marchData.concat(aprilData);

    // Filter the results to include only the days between 11 March and 9 April
    const filteredData = combinedData.filter((day) => {
      const dayNumber = parseInt(day.date.gregorian.day);
      const monthNumber = parseInt(day.date.gregorian.month.number);
      return (
        (monthNumber === 3 && dayNumber >= 11) ||
        (monthNumber === 4 && dayNumber <= 9)
      );
    });

    // Extract only Maghrib and Asr timings
    prayerTimes = filteredData.map((day) => ({
      date: day.date.readable,
      maghrib: day.timings.Maghrib,
      asr: day.timings.Asr,
    }));

    prayerTimesLoaded = true;
  } catch (error) {
    console.error("Error fetching prayer times:", error);
    throw new Error("An error occurred while fetching prayer times.");
  }
}

app.get("/prayer-times", async (req, res) => {
  try {
    if (!prayerTimesLoaded) {
      await fetchPrayerTimes();
    }

    res.json(prayerTimes);
  } catch (error) {
    console.error("Error fetching prayer times:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching prayer times." });
  }
});

app.get("/cooktime", async (req, res) => {
  try {
    const { ingredient, day } = req.query;

    if (!prayerTimesLoaded) {
      await fetchPrayerTimes();
    }

    if (!ingredient || !day) {
      return res
        .status(400)
        .json({ error: "Ingredient and day parameters are required." });
    }

    const dayNumber = parseInt(day);
    if (isNaN(dayNumber)) {
      return res.status(400).json({ error: "Day parameter must be a number." });
    }

    if (dayNumber < 1 || dayNumber > prayerTimes.length) {
      return res.status(400).json({ error: "Invalid day number." });
    }

    const prayerTimeForDay = prayerTimes[dayNumber - 1];

    const { asr, maghrib } = prayerTimeForDay;

    const matchingDishes = dishesData.filter((dish) =>
      dish.ingredients.includes(ingredient)
    );
    const cookingTimes = matchingDishes.map((dish) => {
      const dishCookingTime = calculateCookingTime(asr, dish.duration, maghrib);
      return {
        dishName: dish.name,
        ingredients: dish.ingredients,
        cookingTime: dishCookingTime,
      };
    });

    res.json(cookingTimes);
  } catch (error) {
    console.error("Error fetching cook times:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching cook times." });
  }
});

function calculateCookingTime(asrTime, dishDuration, maghribTime) {
  const [asrHours, asrMinutes] = asrTime
    .split(":")
    .map((part) => parseInt(part));
  const [maghribHours, maghribMinutes] = maghribTime
    .split(":")
    .map((part) => parseInt(part));

  const asrTimeInMinutes = asrHours * 60 + asrMinutes;
  const maghribTimeInMinutes = maghribHours * 60 + maghribMinutes;

  const cookingTimeInMinutes =
    maghribTimeInMinutes - 15 - dishDuration - asrTimeInMinutes;

  const beforeOrAfter = cookingTimeInMinutes >= 0 ? "after" : "before";
  const absCookingTime = Math.abs(cookingTimeInMinutes);

  return `${absCookingTime} minutes ${beforeOrAfter} Asr`;
}

app.get("/suggest", async (req, res) => {
  try {
    const { day } = req.query;

    if (!prayerTimesLoaded) {
      await fetchPrayerTimes();
    }

    if (!day) {
      return res.status(400).json({ error: "Day parameter is required." });
    }

    const dayNumber = parseInt(day);
    if (isNaN(dayNumber)) {
      return res.status(400).json({ error: "Day parameter must be a number." });
    }

    if (dayNumber < 1 || dayNumber > prayerTimes.length) {
      return res.status(400).json({ error: "Invalid day number." });
    }

    const prayerTimeForDay = prayerTimes[dayNumber - 1];

    const { asr, maghrib } = prayerTimeForDay;

    const randomIndex = Math.floor(Math.random() * dishesData.length);
    const randomDish = dishesData[randomIndex];

    const dishCookingTime = calculateCookingTime(
      asr,
      randomDish.duration,
      maghrib
    );

    const suggestion = {
      dishName: randomDish.name,
      ingredients: randomDish.ingredients,
      cookingTime: dishCookingTime,
    };

    res.json(suggestion);
  } catch (error) {
    console.error("Error suggesting dish:", error);
    res
      .status(500)
      .json({ error: "An error occurred while suggesting a dish." });
  }
});

app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});
