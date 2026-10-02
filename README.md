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

All data is kept in one SQLite file (`data/dairy.db`). Copy that file to make a full backup. You can also use **Settings → Download backup**, which saves your records as a JSON file.

## Putting it online for customers

To let customers open the app from their own phones, run it on any small server or VPS that has Node 22 (for example Railway, Render, Fly.io or a ₹300/month VPS). Put HTTPS in front of it, and keep `data/` on a persistent disk. Then share the link with your customers.

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
