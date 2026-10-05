# Fleur

Fleur is an app for people with psoriasis. You do a quick check-in every day, and Fleur uses 12 simple rules to give you a flare risk score for the next 3 days.

## Features

- Daily check-in with 9 quick questions
- Flare risk score from 0 to 100 (Low, Elevated or High)
- See how each rule added to your score
- History calendar of how your skin was each day
- Reset section with breathing exercises, recipes, stretches and a skin care checklist
- Everything is saved on your phone. Only your rough location is used, to get the weather.

## How the score works

Each rule looks at one thing, like stress, sleep, or how your skin compares to normal, and can add up to a set number of points. Sunshine takes points off. The points are added up to get the score. All the rules are in `app/assets/rulebook.json`.

Fleur needs 14 days of check-ins before it shows a score.

## Running the app

```bash
cd app
npm install
npx expo start
```

Then open it in Expo Go, or build it with `npx expo run:android`.

## Tests

```bash
cd app
npm test
npm run typecheck
```

## Folders

- `app/` - the Expo (React Native) app
- `ml/` - Python scripts that make fake patient data, used to test the rules

## Disclaimer

Fleur is an experimental project. It is not a medical device and not medical advice.
