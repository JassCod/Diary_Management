# Milk Dairy Management

A simple, mobile-friendly app for running a village milk dairy (collection centre).

- **Milk buying from farmers**: morning and evening entries, cow or buffalo, litres, fat %. The rate is filled in automatically (a fixed ₹ per litre, or ₹ per fat point × fat).
- **Cold storage stock**: shows how many litres of cow and buffalo milk are in storage right now.
- **Milk going out**: company van pickups (on credit until the company pays), local sales (cash, online or udhaar), and wastage or home use.
- **Feed (cattle feed, khal, choker…)**: buy stock in bulk (cash, online or pay the supplier later), then sell it for cash, online, or **on the khata**, so the cost is cut from the farmer's milk money. Shows stock, stock value and low-stock alerts.
- **Khata / ledger for every person**: milk given, feed taken, payments and a running balance. You can print it or send a summary on WhatsApp.
- **Payments**: pay farmers and receive money from the company or buyers, in cash or online. Lists who you still have to pay and who still owes you.
- **Expenses**: house expenses and dairy business expenses, kept separate, each with cash or online.
- **Where is my money**: cash in hand, online/bank balance, money to receive, money to pay.
- **Reports**: profit from milk and feed, business expenses, house expenses, savings, cash vs online, and day-by-day figures for any dates.
- **Punjabi or English**: switch the language from the top bar, the login page or Settings.
- **Customer portal**: farmers and buyers log in on their own phone with their **mobile number and a PIN** and can only see their own milk, feed, payments and balance.

## Run it

You only need **Node.js 22.13 or newer** (https://nodejs.org). No other packages are required.

```bash
npm start
# open http://localhost:3000
```

On first open, the app asks for your dairy name and an owner password. Then:

1. **Settings**: set your milk rates, local selling rates, and the cash, bank and milk stock you have today.
2. **People**: add farmers (give each one a code number), the milk company, buyers and feed suppliers. Add a mobile number and a 4-digit PIN for anyone who should see their account online.
3. **Feed → Stock & items**: add your feed items.
4. Start entering milk every morning and evening.

Options (environment variables):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Web port |
| `DB_PATH` | `./data/dairy.db` | Where the data file is saved |
| `ADMIN_PASSWORD` | – | Sets the owner password on first start (use this on a public server) |
| `DAIRY_NAME` | – | Dairy name used together with `ADMIN_PASSWORD` |

All data is kept in one SQLite file (`data/dairy.db`). Copy that file to make a full backup. You can also use **Settings → Download backup**, which saves your records as a JSON file.

## Putting it online for customers

To let customers open the app on their own phones, it must run on an internet server. The app is ready for this: it includes a `Dockerfile` and a Render blueprint. You need your own hosting account, so that you own the data and the bill.

### Option A: Railway (easiest, about $5 a month)

1. Sign up at https://railway.com with your GitHub account.
2. Click **New Project → Deploy from GitHub repo** and choose `Diary_Management`. In the service **Settings → Source**, pick the branch that has the app (or merge it into `main` first).
3. Open **Variables** and add:
   - `ADMIN_PASSWORD`: your owner password (this keeps strangers from taking over the setup page)
   - `DAIRY_NAME`: your dairy's name
   - `DB_PATH`: `/data/dairy.db`
4. Right-click the service, choose **Attach volume**, and set the mount path to `/data`. **Without this, your records are lost on every update.**
5. Open **Settings → Networking → Generate Domain**. You get a link like `https://milk-dairy-production.up.railway.app`.
6. Open the link, log in as **Dairy owner** with your password, and share the link with customers.

### Option B: Render (about $7 a month)

1. Sign up at https://render.com with GitHub.
2. Click **New → Blueprint**, pick this repository and branch. Render reads `render.yaml`, which creates the web service and a 1 GB disk at `/data`.
3. Enter `ADMIN_PASSWORD` and `DAIRY_NAME` when it asks, then deploy.

Don't use free plans that have no permanent disk: they delete your data when they restart.

### After it is online

- Use **Settings → Download backup** every week, and keep the file safe.
- Customers log in with their mobile number and the PIN you set for them in **People → person → Edit**.

## Tests

```bash
npm test
```

## How balances work

Every person has one running balance:

- **plus (+)**: the dairy has to pay them (for example, a farmer's milk money)
- **minus (−)**: they have to pay the dairy (for example, feed taken on the khata, or milk the company has not paid for yet)

Milk supplied and money received increase the balance. Feed or milk taken on credit, and money paid by the dairy, reduce it.

**Profit** = milk sold − milk bought + (feed sold − cost of that feed) − business expenses.
House expenses are shown separately, so you can see what is really saved.
