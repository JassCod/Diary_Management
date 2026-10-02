'use strict';
/* Language support: English (default text in the code) and Punjabi (Gurmukhi).
   t('English text {var}', { var }) returns the text in the chosen language. */

const PA = {
  // navigation & common
  'Home': 'ਮੁੱਖ', 'Milk': 'ਦੁੱਧ', 'Feed': 'ਫੀਡ', 'People': 'ਗਾਹਕ', 'Payments': 'ਲੈਣ-ਦੇਣ',
  'Expenses': 'ਖਰਚੇ', 'Reports': 'ਰਿਪੋਰਟ', 'Settings': 'ਸੈਟਿੰਗ', 'More': 'ਹੋਰ', 'Log out': 'ਲੌਗ ਆਊਟ',
  'Account': 'ਖਾਤਾ', 'Close': 'ਬੰਦ ਕਰੋ', 'Please confirm': 'ਪੱਕਾ ਕਰੋ', 'Yes, delete': 'ਹਾਂ, ਮਿਟਾਓ',
  'Cancel': 'ਰੱਦ ਕਰੋ', 'Delete': 'ਮਿਟਾਓ', 'Deleted': 'ਮਿਟਾ ਦਿੱਤਾ', 'Save': 'ਸੇਵ ਕਰੋ', 'Saved': 'ਸੇਵ ਹੋ ਗਿਆ',
  'Edit': 'ਬਦਲੋ', 'Print': 'ਪ੍ਰਿੰਟ', 'Optional': 'ਜ਼ਰੂਰੀ ਨਹੀਂ', 'Loading…': 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…',
  'Date': 'ਤਾਰੀਖ', 'Time': 'ਸਮਾਂ', 'Note': 'ਨੋਟ', 'Total': 'ਕੁੱਲ', 'Amount': 'ਰਕਮ', 'Amount ₹': 'ਰਕਮ ₹',
  'Name': 'ਨਾਮ', 'Type': 'ਕਿਸਮ', 'Status': 'ਹਾਲਤ', 'Yes': 'ਹਾਂ', 'No (hide)': 'ਨਹੀਂ (ਲੁਕਾਓ)',
  'Active': 'ਚਾਲੂ', 'Hidden': 'ਲੁਕੇ ਹੋਏ', 'hidden': 'ਲੁਕਿਆ', 'Mode': 'ਤਰੀਕਾ', 'Payment': 'ਭੁਗਤਾਨ',
  'From': 'ਤੋਂ', 'To': 'ਤੱਕ', 'Today': 'ਅੱਜ', 'This 10 days': 'ਇਹ 10 ਦਿਨ', 'This month': 'ਇਸ ਮਹੀਨੇ',
  'Last month': 'ਪਿਛਲਾ ਮਹੀਨਾ', 'This year': 'ਇਸ ਸਾਲ', 'Cannot reach the server.': 'ਸਰਵਰ ਨਾਲ ਸੰਪਰਕ ਨਹੀਂ ਹੋਇਆ।',
  'Something went wrong': 'ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ', 'Something went wrong. Please try again.': 'ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',

  // milk words
  'Cow': 'ਗਾਂ', 'Buffalo': 'ਮੱਝ', 'Morning': 'ਸਵੇਰ', 'Evening': 'ਸ਼ਾਮ', 'L': 'ਲੀ.', 'Litres': 'ਲੀਟਰ',
  'Fat %': 'ਫੈਟ %', 'Fat': 'ਫੈਟ', 'fat': 'ਫੈਟ', 'avg fat': 'ਔਸਤ ਫੈਟ', 'Avg fat': 'ਔਸਤ ਫੈਟ',
  'Rate ₹/L': 'ਰੇਟ ₹/ਲੀ.', 'Rate ₹': 'ਰੇਟ ₹', '₹{r} × fat': '₹{r} × ਫੈਟ', '₹{r} / L': '₹{r} / ਲੀ.',
  'Cash': 'ਨਕਦ', 'Online': 'ਆਨਲਾਈਨ', 'Online / UPI': 'ਆਨਲਾਈਨ / UPI', 'Udhaar': 'ਉਧਾਰ', 'Khata': 'ਖਾਤਾ',

  // balances & party kinds
  'All settled': 'ਹਿਸਾਬ ਬਰਾਬਰ', 'Settled': 'ਬਰਾਬਰ', 'All settled 👍': 'ਹਿਸਾਬ ਬਰਾਬਰ 👍',
  'Dairy has to pay {amt}': 'ਡੇਅਰੀ ਨੇ {amt} ਦੇਣੇ ਹਨ', 'Has to pay dairy {amt}': 'ਡੇਅਰੀ ਨੂੰ {amt} ਦੇਣੇ ਹਨ',
  'Pay {amt}': 'ਦੇਣੇ {amt}', 'Due {amt}': 'ਲੈਣੇ {amt}',
  'Farmer (sells milk)': 'ਕਿਸਾਨ (ਦੁੱਧ ਵੇਚਦਾ)', 'Milk buyer': 'ਦੁੱਧ ਖਰੀਦਦਾਰ', 'Milk company': 'ਦੁੱਧ ਕੰਪਨੀ',
  'Feed customer': 'ਫੀਡ ਗਾਹਕ', 'Feed supplier': 'ਫੀਡ ਸਪਲਾਇਰ',
  'Farmer': 'ਕਿਸਾਨ', 'Buyer': 'ਖਰੀਦਦਾਰ', 'Company': 'ਕੰਪਨੀ', 'Supplier': 'ਸਪਲਾਇਰ',

  // picker
  'Search name / code / village': 'ਨਾਮ / ਕੋਡ / ਪਿੰਡ ਲੱਭੋ',
  'No match. Add the person in “People”.': 'ਕੋਈ ਨਹੀਂ ਮਿਲਿਆ। “ਗਾਹਕ” ਵਿੱਚ ਜੋੜੋ।',
  'Delete this entry? This cannot be undone.': 'ਕੀ ਇਹ ਐਂਟਰੀ ਮਿਟਾਉਣੀ ਹੈ? ਇਹ ਵਾਪਸ ਨਹੀਂ ਆਵੇਗੀ।',

  // setup & login
  'Welcome! Let’s set up your dairy': 'ਜੀ ਆਇਆਂ ਨੂੰ! ਆਪਣੀ ਡੇਅਰੀ ਸੈੱਟ ਕਰੋ',
  'This takes 10 seconds.': 'ਬੱਸ 10 ਸਕਿੰਟ ਲੱਗਣਗੇ।', 'Dairy name': 'ਡੇਅਰੀ ਦਾ ਨਾਮ',
  'e.g. Waheguru Milk Dairy': 'ਜਿਵੇਂ ਵਾਹਿਗੁਰੂ ਮਿਲਕ ਡੇਅਰੀ',
  'Owner password (keep it secret)': 'ਮਾਲਕ ਦਾ ਪਾਸਵਰਡ (ਗੁਪਤ ਰੱਖੋ)', 'Type password again': 'ਪਾਸਵਰਡ ਦੁਬਾਰਾ ਲਿਖੋ',
  'Start': 'ਸ਼ੁਰੂ ਕਰੋ', 'Both passwords are not the same': 'ਦੋਵੇਂ ਪਾਸਵਰਡ ਇੱਕੋ ਜਿਹੇ ਨਹੀਂ ਹਨ',
  'Customer': 'ਗਾਹਕ', 'Dairy owner': 'ਡੇਅਰੀ ਮਾਲਕ',
  'See your milk, feed and payment record.': 'ਆਪਣਾ ਦੁੱਧ, ਫੀਡ ਅਤੇ ਪੈਸਿਆਂ ਦਾ ਹਿਸਾਬ ਦੇਖੋ।',
  'Mobile number': 'ਮੋਬਾਈਲ ਨੰਬਰ', 'PIN (ask the dairy)': 'PIN (ਡੇਅਰੀ ਤੋਂ ਪੁੱਛੋ)',
  'See my account': 'ਮੇਰਾ ਖਾਤਾ ਦੇਖੋ', 'Password': 'ਪਾਸਵਰਡ', 'Log in': 'ਲੌਗ ਇਨ',

  // home
  'Namaste': 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'Milk entry': 'ਦੁੱਧ ਐਂਟਰੀ', 'Milk out / Sale': 'ਦੁੱਧ ਬਾਹਰ / ਵਿਕਰੀ',
  'Sell feed': 'ਫੀਡ ਵੇਚੋ', 'Pay / Receive': 'ਦਿਓ / ਲਓ', 'Add expense': 'ਖਰਚਾ ਜੋੜੋ',
  'Feed stock low:': 'ਫੀਡ ਘੱਟ ਹੈ:', 'Cold storage now': 'ਹੁਣ ਕੋਲਡ ਸਟੋਰੇਜ ਵਿੱਚ', 'Cow milk': 'ਗਾਂ ਦਾ ਦੁੱਧ',
  'Buffalo milk': 'ਮੱਝ ਦਾ ਦੁੱਧ', 'Last company pickup:': 'ਕੰਪਨੀ ਨੇ ਆਖਰੀ ਵਾਰ ਚੁੱਕਿਆ:',
  'Today’s collection': 'ਅੱਜ ਦਾ ਦੁੱਧ', 'Milk bought today': 'ਅੱਜ ਖਰੀਦਿਆ ਦੁੱਧ', 'Entries today': 'ਅੱਜ ਦੀਆਂ ਐਂਟਰੀਆਂ',
  'Where is my money': 'ਮੇਰੇ ਪੈਸੇ ਕਿੱਥੇ ਹਨ', 'Cash in hand': 'ਹੱਥ ਵਿੱਚ ਨਕਦ', 'Online / Bank': 'ਆਨਲਾਈਨ / ਬੈਂਕ',
  'To receive (from people)': 'ਲੈਣੇ ਹਨ (ਲੋਕਾਂ ਤੋਂ)', 'To pay (to people)': 'ਦੇਣੇ ਹਨ (ਲੋਕਾਂ ਨੂੰ)',
  'Full report': 'ਪੂਰੀ ਰਿਪੋਰਟ', 'Milk sold': 'ਦੁੱਧ ਵੇਚਿਆ', 'Milk bought': 'ਦੁੱਧ ਖਰੀਦਿਆ', 'Feed profit': 'ਫੀਡ ਦਾ ਮੁਨਾਫ਼ਾ',
  'Business expenses': 'ਕਾਰੋਬਾਰ ਦੇ ਖਰਚੇ', 'Business profit': 'ਕਾਰੋਬਾਰ ਦਾ ਮੁਨਾਫ਼ਾ', 'House expenses': 'ਘਰ ਦੇ ਖਰਚੇ',
  'Saved': 'ਬੱਚਤ', 'Last 7 days milk collected': 'ਪਿਛਲੇ 7 ਦਿਨਾਂ ਦਾ ਦੁੱਧ',

  // milk pages
  'Buy from farmers': 'ਕਿਸਾਨਾਂ ਤੋਂ ਖਰੀਦ', 'New milk entry': 'ਨਵੀਂ ਦੁੱਧ ਐਂਟਰੀ', 'Milk type': 'ਦੁੱਧ ਦੀ ਕਿਸਮ',
  'Save entry': 'ਐਂਟਰੀ ਸੇਵ ਕਰੋ', 'No entries yet for this time.': 'ਇਸ ਸਮੇਂ ਦੀ ਕੋਈ ਐਂਟਰੀ ਨਹੀਂ।',
  'Saved: {name} {qty} L': 'ਸੇਵ ਹੋਇਆ: {name} {qty} ਲੀ.', 'Saved: {qty} L {type}': 'ਸੇਵ ਹੋਇਆ: {qty} ਲੀ. {type}',
  'Milk going out of cold storage': 'ਕੋਲਡ ਸਟੋਰੇਜ ਤੋਂ ਬਾਹਰ ਗਿਆ ਦੁੱਧ', 'Where did the milk go?': 'ਦੁੱਧ ਕਿੱਥੇ ਗਿਆ?',
  'Company van': 'ਕੰਪਨੀ ਦੀ ਗੱਡੀ', 'Local sale': 'ਲੋਕਲ ਵਿਕਰੀ', 'Waste / home': 'ਖਰਾਬ / ਘਰ',
  'Waste / home use': 'ਖਰਾਬ / ਘਰ ਵਰਤਿਆ', 'Or buyer name (walk-in)': 'ਜਾਂ ਖਰੀਦਦਾਰ ਦਾ ਨਾਮ',
  'Udhaar / later': 'ਉਧਾਰ / ਬਾਅਦ ਵਿੱਚ', 'Van / vehicle no.': 'ਗੱਡੀ ਨੰਬਰ', 'Recent (last 30 days)': 'ਹਾਲ ਹੀ ਦੇ (ਪਿਛਲੇ 30 ਦਿਨ)',
  'Buyer (from people list – needed for udhaar)': 'ਖਰੀਦਦਾਰ (ਗਾਹਕ ਸੂਚੀ ਵਿੱਚੋਂ – ਉਧਾਰ ਲਈ ਜ਼ਰੂਰੀ)',
  'Cow milk in storage': 'ਸਟੋਰੇਜ ਵਿੱਚ ਗਾਂ ਦਾ ਦੁੱਧ', 'Buffalo milk in storage': 'ਸਟੋਰੇਜ ਵਿੱਚ ਮੱਝ ਦਾ ਦੁੱਧ',
  'Nothing yet.': 'ਅਜੇ ਕੁਝ ਨਹੀਂ।',

  // feed
  'Stock & items': 'ਸਟਾਕ ਤੇ ਚੀਜ਼ਾਂ', 'Buy stock': 'ਸਟਾਕ ਖਰੀਦੋ',
  'First add your feed items (like Khal, Choker, Feed bag, Mineral mixture).': 'ਪਹਿਲਾਂ ਆਪਣੀਆਂ ਫੀਡ ਚੀਜ਼ਾਂ ਜੋੜੋ (ਜਿਵੇਂ ਖਲ, ਚੋਕਰ, ਫੀਡ ਬੋਰੀ, ਮਿਨਰਲ ਮਿਕਸਚਰ)।',
  'Add feed items': 'ਫੀਡ ਚੀਜ਼ਾਂ ਜੋੜੋ', 'stock': 'ਸਟਾਕ', 'Search customer (leave empty for walk-in)': 'ਗਾਹਕ ਲੱਭੋ (ਬਾਹਰਲੇ ਲਈ ਖਾਲੀ ਛੱਡੋ)',
  'Or walk-in buyer name': 'ਜਾਂ ਬਾਹਰਲੇ ਖਰੀਦਦਾਰ ਦਾ ਨਾਮ', 'Feed item': 'ਫੀਡ ਚੀਜ਼', 'Quantity': 'ਮਾਤਰਾ',
  'Cut from milk money': 'ਦੁੱਧ ਦੇ ਪੈਸਿਆਂ ਵਿੱਚੋਂ ਕੱਟੋ', 'Save sale': 'ਵਿਕਰੀ ਸੇਵ ਕਰੋ', 'Recent feed sales': 'ਹਾਲ ਦੀ ਫੀਡ ਵਿਕਰੀ',
  'Walk-in': 'ਬਾਹਰਲਾ ਗਾਹਕ', 'No feed sold in last 30 days.': 'ਪਿਛਲੇ 30 ਦਿਨਾਂ ਵਿੱਚ ਕੋਈ ਫੀਡ ਨਹੀਂ ਵਿਕੀ।',
  'Feed sale saved': 'ਫੀਡ ਵਿਕਰੀ ਸੇਵ ਹੋਈ', 'Feed items & stock': 'ਫੀਡ ਚੀਜ਼ਾਂ ਤੇ ਸਟਾਕ', 'Add item': 'ਚੀਜ਼ ਜੋੜੋ',
  'Item': 'ਚੀਜ਼', 'Stock': 'ਸਟਾਕ', 'Buy ₹': 'ਖਰੀਦ ₹', 'Sell ₹': 'ਵਿਕਰੀ ₹', 'Stock value': 'ਸਟਾਕ ਦੀ ਕੀਮਤ',
  'per {unit}': 'ਪ੍ਰਤੀ {unit}', 'Total stock value': 'ਕੁੱਲ ਸਟਾਕ ਦੀ ਕੀਮਤ', 'No feed items yet.': 'ਅਜੇ ਕੋਈ ਫੀਡ ਚੀਜ਼ ਨਹੀਂ।',
  'Edit feed item': 'ਫੀਡ ਚੀਜ਼ ਬਦਲੋ', 'New feed item': 'ਨਵੀਂ ਫੀਡ ਚੀਜ਼', 'e.g. Cattle feed 50kg': 'ਜਿਵੇਂ ਪਸ਼ੂ ਫੀਡ 50 ਕਿਲੋ',
  'Unit': 'ਇਕਾਈ', 'Opening stock': 'ਸ਼ੁਰੂਆਤੀ ਸਟਾਕ', 'Purchase price ₹': 'ਖਰੀਦ ਮੁੱਲ ₹', 'Sale price ₹': 'ਵੇਚ ਮੁੱਲ ₹',
  'Warn when stock below': 'ਇਸ ਤੋਂ ਘੱਟ ਹੋਣ ਤੇ ਦੱਸੋ', 'Show in lists': 'ਸੂਚੀ ਵਿੱਚ ਦਿਖਾਓ',
  'bag': 'ਬੋਰੀ', 'kg': 'ਕਿਲੋ', 'quintal': 'ਕੁਇੰਟਲ', 'packet': 'ਪੈਕਟ', 'litre': 'ਲੀਟਰ', 'piece': 'ਪੀਸ',
  'Buy feed stock (bulk)': 'ਫੀਡ ਸਟਾਕ ਖਰੀਦੋ (ਥੋਕ)', 'Rate ₹ (per unit)': 'ਰੇਟ ₹ (ਪ੍ਰਤੀ ਇਕਾਈ)',
  'Search supplier (optional)': 'ਸਪਲਾਇਰ ਲੱਭੋ (ਜ਼ਰੂਰੀ ਨਹੀਂ)', 'Pay later': 'ਬਾਅਦ ਵਿੱਚ ਦੇਣਾ',
  'Note / bill no.': 'ਨੋਟ / ਬਿੱਲ ਨੰ.', 'Add to stock': 'ਸਟਾਕ ਵਿੱਚ ਜੋੜੋ', 'Recent purchases': 'ਹਾਲ ਦੀ ਖਰੀਦ',
  'No purchases in last 90 days.': 'ਪਿਛਲੇ 90 ਦਿਨਾਂ ਵਿੱਚ ਕੋਈ ਖਰੀਦ ਨਹੀਂ।', 'Stock added': 'ਸਟਾਕ ਜੁੜ ਗਿਆ',

  // people
  'Add person': 'ਨਵਾਂ ਗਾਹਕ ਜੋੜੋ', 'Search name, code, village, phone': 'ਨਾਮ, ਕੋਡ, ਪਿੰਡ, ਫ਼ੋਨ ਲੱਭੋ',
  'Dairy has to pay': 'ਡੇਅਰੀ ਨੇ ਦੇਣੇ ਹਨ', 'Dairy will receive': 'ਡੇਅਰੀ ਨੇ ਲੈਣੇ ਹਨ',
  'All': 'ਸਾਰੇ', 'Farmers': 'ਕਿਸਾਨ', 'Buyers': 'ਖਰੀਦਦਾਰ', 'Suppliers': 'ਸਪਲਾਇਰ', 'To pay': 'ਦੇਣੇ',
  'To receive': 'ਲੈਣੇ', 'Nobody here yet. Tap “+ Add person”.': 'ਅਜੇ ਕੋਈ ਨਹੀਂ। “+ ਨਵਾਂ ਗਾਹਕ ਜੋੜੋ” ਦਬਾਓ।',
  'Edit person': 'ਗਾਹਕ ਬਦਲੋ', 'Code / number': 'ਕੋਡ / ਨੰਬਰ', 'e.g. 12': 'ਜਿਵੇਂ 12', 'Mobile': 'ਮੋਬਾਈਲ',
  'Village': 'ਪਿੰਡ', 'Old balance (when starting the app)': 'ਪੁਰਾਣਾ ਬਕਾਇਆ (ਐਪ ਸ਼ੁਰੂ ਕਰਨ ਵੇਲੇ)',
  'They have to pay': 'ਉਹਨਾਂ ਨੇ ਦੇਣੇ ਹਨ',
  'Customer login PIN (already set – type to change)': 'ਗਾਹਕ ਲੌਗਇਨ PIN (ਪਹਿਲਾਂ ਹੀ ਹੈ – ਬਦਲਣ ਲਈ ਲਿਖੋ)',
  'Customer login PIN (4–6 digits)': 'ਗਾਹਕ ਲੌਗਇਨ PIN (4–6 ਅੰਕ)',
  'With mobile + PIN the person can log in and see their own record.': 'ਮੋਬਾਈਲ + PIN ਨਾਲ ਗਾਹਕ ਆਪਣਾ ਹਿਸਾਬ ਖੁਦ ਦੇਖ ਸਕਦਾ ਹੈ।',
  'Remove login PIN': 'ਲੌਗਇਨ PIN ਹਟਾਓ',
  'Milk given': 'ਦੁੱਧ ਦਿੱਤਾ', 'Milk taken': 'ਦੁੱਧ ਲਿਆ', 'Feed supplied': 'ਫੀਡ ਆਈ',
  'Paid by dairy': 'ਡੇਅਰੀ ਨੇ ਦਿੱਤੇ', 'Received by dairy': 'ਡੇਅਰੀ ਨੂੰ ਮਿਲੇ', 'Statement': 'ਹਿਸਾਬ',
  'No mobile': 'ਮੋਬਾਈਲ ਨਹੀਂ', 'Can log in': 'ਲੌਗਇਨ ਕਰ ਸਕਦਾ', 'No login PIN': 'ਲੌਗਇਨ PIN ਨਹੀਂ',
  'Dairy pays': 'ਡੇਅਰੀ ਦੇਵੇ', 'Receive money': 'ਪੈਸੇ ਲਓ', 'Feed taken (khata)': 'ਫੀਡ ਲਈ (ਖਾਤੇ ਵਿੱਚ)',
  'Record': 'ਹਿਸਾਬ', 'Statement for {name}': '{name} ਦਾ ਹਿਸਾਬ', 'Balance': 'ਬਕਾਇਆ',
  'See full details:': 'ਪੂਰਾ ਹਿਸਾਬ ਦੇਖੋ:', 'Opening balance': 'ਸ਼ੁਰੂਆਤੀ ਬਕਾਇਆ', 'Closing balance': 'ਆਖਰੀ ਬਕਾਇਆ',
  'Bal': 'ਬਕਾਇਆ', 'Details': 'ਵੇਰਵਾ', 'Credit': 'ਜਮ੍ਹਾਂ', 'Debit': 'ਨਾਮ',
  'Balance in plus (+) = dairy has to pay. In minus (−) = person has to pay dairy.': 'ਬਕਾਇਆ ਪਲੱਸ (+) = ਡੇਅਰੀ ਨੇ ਦੇਣੇ ਹਨ। ਮਾਈਨਸ (−) = ਗਾਹਕ ਨੇ ਡੇਅਰੀ ਨੂੰ ਦੇਣੇ ਹਨ।',
  'Pay {name}': '{name} ਨੂੰ ਦਿਓ', 'Receive from {name}': '{name} ਤੋਂ ਲਓ', 'e.g. 1–10 Oct milk bill': 'ਜਿਵੇਂ 1–10 ਅਕਤੂਬਰ ਦੁੱਧ ਬਿੱਲ',
  'Payment saved': 'ਭੁਗਤਾਨ ਸੇਵ ਹੋਇਆ',

  // payments
  'Pay or receive money': 'ਪੈਸੇ ਦਿਓ ਜਾਂ ਲਓ', 'Dairy receives': 'ਡੇਅਰੀ ਲਵੇ', 'Person': 'ਗਾਹਕ',
  'Save payment': 'ਭੁਗਤਾਨ ਸੇਵ ਕਰੋ', 'Pending: dairy has to pay': 'ਬਾਕੀ: ਡੇਅਰੀ ਨੇ ਦੇਣੇ ਹਨ',
  'Pending: to receive': 'ਬਾਕੀ: ਲੈਣੇ ਹਨ', 'Recent payments': 'ਹਾਲ ਦੇ ਭੁਗਤਾਨ', 'Pay': 'ਦਿਓ', 'Receive': 'ਲਓ',
  'Nothing pending 🎉': 'ਕੁਝ ਬਾਕੀ ਨਹੀਂ 🎉', 'Received': 'ਮਿਲੇ', 'No payments in last 60 days.': 'ਪਿਛਲੇ 60 ਦਿਨਾਂ ਵਿੱਚ ਕੋਈ ਭੁਗਤਾਨ ਨਹੀਂ।',

  // expenses
  'House': 'ਘਰ', 'Dairy business': 'ਡੇਅਰੀ ਕਾਰੋਬਾਰ', 'Spent on': 'ਕਿਸ ਤੇ ਖਰਚਿਆ', 'Or type here': 'ਜਾਂ ਇੱਥੇ ਲਿਖੋ',
  'Paid by': 'ਕਿਵੇਂ ਦਿੱਤੇ', 'Save expense': 'ਖਰਚਾ ਸੇਵ ਕਰੋ', 'Expense saved': 'ਖਰਚਾ ਸੇਵ ਹੋਇਆ',
  'House (this month)': 'ਘਰ (ਇਸ ਮਹੀਨੇ)', 'Business (this month)': 'ਕਾਰੋਬਾਰ (ਇਸ ਮਹੀਨੇ)',
  'No expenses this month.': 'ਇਸ ਮਹੀਨੇ ਕੋਈ ਖਰਚਾ ਨਹੀਂ।',
  'Ration / Grocery': 'ਰਾਸ਼ਨ / ਕਰਿਆਨਾ', 'Vegetables & Milk': 'ਸਬਜ਼ੀ ਤੇ ਦੁੱਧ', 'Electricity': 'ਬਿਜਲੀ', 'Gas': 'ਗੈਸ',
  'School / Fees': 'ਸਕੂਲ / ਫੀਸ', 'Medical': 'ਦਵਾਈ / ਡਾਕਟਰ', 'Clothes': 'ਕੱਪੜੇ', 'Mobile / Internet': 'ਮੋਬਾਈਲ / ਇੰਟਰਨੈੱਟ',
  'Travel / Petrol': 'ਸਫ਼ਰ / ਪੈਟਰੋਲ', 'Function / Gifts': 'ਵਿਆਹ-ਸ਼ਾਦੀ / ਤੋਹਫ਼ੇ', 'Loan EMI': 'ਕਰਜ਼ੇ ਦੀ ਕਿਸ਼ਤ', 'Other': 'ਹੋਰ',
  'Electricity (dairy)': 'ਬਿਜਲੀ (ਡੇਅਰੀ)', 'Diesel / Generator': 'ਡੀਜ਼ਲ / ਜਨਰੇਟਰ', 'Labour / Salary': 'ਮਜ਼ਦੂਰੀ / ਤਨਖਾਹ',
  'Transport': 'ਢੋਆ-ਢੁਆਈ', 'Cans & Equipment': 'ਡਰੰਮ ਤੇ ਸਮਾਨ', 'Repair': 'ਮੁਰੰਮਤ', 'Rent': 'ਕਿਰਾਇਆ',
  'Testing / Chemicals': 'ਟੈਸਟਿੰਗ / ਕੈਮੀਕਲ',

  // reports
  'Saved (profit − house)': 'ਬੱਚਤ (ਮੁਨਾਫ਼ਾ − ਘਰ)', 'Milk wasted / home': 'ਖਰਾਬ / ਘਰ ਵਰਤਿਆ ਦੁੱਧ',
  'Profit & loss': 'ਨਫ਼ਾ ਨੁਕਸਾਨ', 'Milk profit': 'ਦੁੱਧ ਦਾ ਮੁਨਾਫ਼ਾ', 'Feed sold': 'ਫੀਡ ਵੇਚੀ', 'Cost of that feed': 'ਉਸ ਫੀਡ ਦੀ ਲਾਗਤ',
  'Feed bought for stock in this period: {amt} (counted as profit only when sold).': 'ਇਸ ਸਮੇਂ ਸਟਾਕ ਲਈ ਖਰੀਦੀ ਫੀਡ: {amt} (ਮੁਨਾਫ਼ਾ ਵਿਕਣ ਤੇ ਹੀ ਗਿਣਿਆ ਜਾਂਦਾ ਹੈ)।',
  'Milk by type': 'ਕਿਸਮ ਅਨੁਸਾਰ ਦੁੱਧ', 'Bought': 'ਖਰੀਦਿਆ', 'Sold': 'ਵੇਚਿਆ', 'Now in cold storage:': 'ਹੁਣ ਕੋਲਡ ਸਟੋਰੇਜ ਵਿੱਚ:',
  'Cash vs Online in this period': 'ਇਸ ਸਮੇਂ ਨਕਦ ਤੇ ਆਨਲਾਈਨ', 'Milk sales': 'ਦੁੱਧ ਵਿਕਰੀ', 'Feed sales': 'ਫੀਡ ਵਿਕਰੀ',
  'Received from people': 'ਲੋਕਾਂ ਤੋਂ ਮਿਲੇ', 'Paid to people': 'ਲੋਕਾਂ ਨੂੰ ਦਿੱਤੇ', 'Feed stock bought': 'ਫੀਡ ਸਟਾਕ ਖਰੀਦਿਆ',
  'Net change': 'ਕੁੱਲ ਫ਼ਰਕ', 'Balance today': 'ਅੱਜ ਦਾ ਬਕਾਇਆ', 'Where the money went': 'ਪੈਸੇ ਕਿੱਥੇ ਗਏ',
  'No expenses in this period.': 'ਇਸ ਸਮੇਂ ਕੋਈ ਖਰਚਾ ਨਹੀਂ।', 'Day by day milk': 'ਰੋਜ਼ਾਨਾ ਦੁੱਧ', 'In': 'ਆਇਆ', 'Out': 'ਗਿਆ',
  'No milk entries in this period.': 'ਇਸ ਸਮੇਂ ਦੁੱਧ ਦੀ ਕੋਈ ਐਂਟਰੀ ਨਹੀਂ।',

  // settings
  'Dairy details': 'ਡੇਅਰੀ ਦਾ ਵੇਰਵਾ', 'Phone (shown to customers)': 'ਫ਼ੋਨ (ਗਾਹਕਾਂ ਨੂੰ ਦਿਖੇਗਾ)', 'Address': 'ਪਤਾ',
  'Milk buying rates': 'ਦੁੱਧ ਖਰੀਦ ਰੇਟ', 'rate type': 'ਰੇਟ ਦੀ ਕਿਸਮ', 'Fixed ₹ per litre': 'ਪੱਕਾ ₹ ਪ੍ਰਤੀ ਲੀਟਰ',
  '₹ per fat point (rate × fat)': '₹ ਪ੍ਰਤੀ ਫੈਟ (ਰੇਟ × ਫੈਟ)',
  'Example: fat type with ₹7.50 and fat 6.5 → ₹48.75 per litre.': 'ਉਦਾਹਰਨ: ₹7.50 ਤੇ ਫੈਟ 6.5 → ₹48.75 ਪ੍ਰਤੀ ਲੀਟਰ।',
  'Local selling rates (₹ per litre)': 'ਲੋਕਲ ਵੇਚ ਰੇਟ (₹ ਪ੍ਰਤੀ ਲੀਟਰ)',
  'Starting balances (when you began using the app)': 'ਸ਼ੁਰੂਆਤੀ ਬਕਾਇਆ (ਐਪ ਸ਼ੁਰੂ ਕਰਨ ਵੇਲੇ)',
  'Bank / online': 'ਬੈਂਕ / ਆਨਲਾਈਨ', 'Cow milk in storage (L)': 'ਸਟੋਰੇਜ ਵਿੱਚ ਗਾਂ ਦਾ ਦੁੱਧ (ਲੀ.)',
  'Buffalo milk in storage (L)': 'ਸਟੋਰੇਜ ਵਿੱਚ ਮੱਝ ਦਾ ਦੁੱਧ (ਲੀ.)', 'Save settings': 'ਸੈਟਿੰਗ ਸੇਵ ਕਰੋ',
  'Settings saved': 'ਸੈਟਿੰਗ ਸੇਵ ਹੋਈ', 'Language': 'ਭਾਸ਼ਾ',
  'Each phone remembers its own language. Customers can also switch on their login page.': 'ਹਰ ਫ਼ੋਨ ਆਪਣੀ ਭਾਸ਼ਾ ਯਾਦ ਰੱਖਦਾ ਹੈ। ਗਾਹਕ ਲੌਗਇਨ ਪੰਨੇ ਤੇ ਵੀ ਬਦਲ ਸਕਦੇ ਹਨ।',
  'Customer login': 'ਗਾਹਕ ਲੌਗਇਨ',
  'Customers open {link} on their phone and log in with their mobile number + PIN. Set the PIN in People → person → Edit.': 'ਗਾਹਕ ਆਪਣੇ ਫ਼ੋਨ ਤੇ {link} ਖੋਲ੍ਹ ਕੇ ਮੋਬਾਈਲ ਨੰਬਰ + PIN ਨਾਲ ਲੌਗਇਨ ਕਰਦੇ ਹਨ। PIN ਗਾਹਕ → ਨਾਮ → ਬਦਲੋ ਵਿੱਚ ਰੱਖੋ।',
  'Copy link': 'ਲਿੰਕ ਕਾਪੀ ਕਰੋ', 'Link copied': 'ਲਿੰਕ ਕਾਪੀ ਹੋ ਗਿਆ', 'Change owner password': 'ਮਾਲਕ ਦਾ ਪਾਸਵਰਡ ਬਦਲੋ',
  'Current password': 'ਮੌਜੂਦਾ ਪਾਸਵਰਡ', 'New password': 'ਨਵਾਂ ਪਾਸਵਰਡ', 'Change password': 'ਪਾਸਵਰਡ ਬਦਲੋ',
  'Password changed': 'ਪਾਸਵਰਡ ਬਦਲ ਗਿਆ', 'Backup': 'ਬੈਕਅੱਪ',
  'Download all your records as a file. Keep it safe (e.g. on Google Drive) every week.': 'ਆਪਣਾ ਸਾਰਾ ਰਿਕਾਰਡ ਫਾਈਲ ਵਿੱਚ ਡਾਊਨਲੋਡ ਕਰੋ। ਹਰ ਹਫ਼ਤੇ ਸੰਭਾਲ ਕੇ ਰੱਖੋ (ਜਿਵੇਂ Google Drive ਤੇ)।',
  'Download backup': 'ਬੈਕਅੱਪ ਡਾਊਨਲੋਡ ਕਰੋ',

  // portal
  'Dairy will pay you': 'ਡੇਅਰੀ ਤੁਹਾਨੂੰ ਦੇਵੇਗੀ', 'You have to pay the dairy': 'ਤੁਸੀਂ ਡੇਅਰੀ ਨੂੰ ਦੇਣੇ ਹਨ',
  'Hello, {name}': 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ, {name}', 'Code': 'ਕੋਡ', 'Call dairy:': 'ਡੇਅਰੀ ਨੂੰ ਫ਼ੋਨ ਕਰੋ:',
  'Milk amount': 'ਦੁੱਧ ਦੀ ਰਕਮ', 'Feed (cut)': 'ਫੀਡ (ਕੱਟੀ)', 'Paid to you': 'ਤੁਹਾਨੂੰ ਦਿੱਤੇ', 'Daily milk': 'ਰੋਜ਼ਾਨਾ ਦੁੱਧ',
  'Full account': 'ਪੂਰਾ ਖਾਤਾ',

  // milk from photo
  'From photo': 'ਫੋਟੋ ਤੋਂ', 'Milk entry from photo': 'ਫੋਟੋ ਤੋਂ ਦੁੱਧ ਐਂਟਰੀ',
  'Take a photo of your milk register or receipt and the app fills in all entries for you to check.': 'ਆਪਣੇ ਦੁੱਧ ਰਜਿਸਟਰ ਜਾਂ ਪਰਚੀ ਦੀ ਫੋਟੋ ਖਿੱਚੋ, ਐਪ ਸਾਰੀਆਂ ਐਂਟਰੀਆਂ ਭਰ ਦੇਵੇਗੀ, ਤੁਸੀਂ ਸਿਰਫ਼ ਚੈੱਕ ਕਰਨੀਆਂ ਹਨ।',
  'Photo reading is not switched on yet. Add an Anthropic API key as ANTHROPIC_API_KEY in your server settings (see README), then restart.': 'ਫੋਟੋ ਪੜ੍ਹਨਾ ਅਜੇ ਚਾਲੂ ਨਹੀਂ ਹੈ। ਸਰਵਰ ਸੈਟਿੰਗ ਵਿੱਚ ANTHROPIC_API_KEY ਪਾਓ (README ਦੇਖੋ), ਫਿਰ ਦੁਬਾਰਾ ਚਲਾਓ।',
  'Take a clear photo of the whole page in good light. You will check every line before saving.': 'ਚੰਗੀ ਰੋਸ਼ਨੀ ਵਿੱਚ ਪੂਰੇ ਪੰਨੇ ਦੀ ਸਾਫ਼ ਫੋਟੋ ਖਿੱਚੋ। ਸੇਵ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਤੁਸੀਂ ਹਰ ਲਾਈਨ ਚੈੱਕ ਕਰੋਗੇ।',
  'Take / choose photo': 'ਫੋਟੋ ਖਿੱਚੋ / ਚੁਣੋ', 'Read photo': 'ਫੋਟੋ ਪੜ੍ਹੋ', 'Check and save': 'ਚੈੱਕ ਕਰੋ ਤੇ ਸੇਵ ਕਰੋ',
  'Lines read from the photo will show here.': 'ਫੋਟੋ ਵਿੱਚੋਂ ਪੜ੍ਹੀਆਂ ਲਾਈਨਾਂ ਇੱਥੇ ਦਿਖਣਗੀਆਂ।',
  'Reading the photo… this can take up to a minute.': 'ਫੋਟੋ ਪੜ੍ਹੀ ਜਾ ਰਹੀ ਹੈ… ਇੱਕ ਮਿੰਟ ਤੱਕ ਲੱਗ ਸਕਦਾ ਹੈ।',
  'Found {n} lines. Please check the yellow ones.': '{n} ਲਾਈਨਾਂ ਮਿਲੀਆਂ। ਪੀਲੀਆਂ ਲਾਈਨਾਂ ਧਿਆਨ ਨਾਲ ਚੈੱਕ ਕਰੋ।',
  'No milk lines found. Try a clearer photo.': 'ਕੋਈ ਦੁੱਧ ਲਾਈਨ ਨਹੀਂ ਮਿਲੀ। ਹੋਰ ਸਾਫ਼ ਫੋਟੋ ਖਿੱਚੋ।',
  'On paper:': 'ਕਾਗਜ਼ ਤੇ:', 'on paper': 'ਕਾਗਜ਼ ਤੇ', 'Please check': 'ਚੈੱਕ ਕਰੋ', 'Choose farmer': 'ਕਿਸਾਨ ਚੁਣੋ',
  'Save all {n} entries': 'ਸਾਰੀਆਂ {n} ਐਂਟਰੀਆਂ ਸੇਵ ਕਰੋ', '{n} entries saved': '{n} ਐਂਟਰੀਆਂ ਸੇਵ ਹੋਈਆਂ',
  'Line {n}: please choose the farmer': 'ਲਾਈਨ {n}: ਕਿਸਾਨ ਚੁਣੋ', 'Please choose a photo': 'ਫੋਟੋ ਚੁਣੋ',
  'Nothing to save': 'ਸੇਵ ਕਰਨ ਲਈ ਕੁਝ ਨਹੀਂ', 'Too many lines at once': 'ਇੱਕ ਵਾਰ ਵਿੱਚ ਬਹੁਤ ਲਾਈਨਾਂ',
  'Photo reading is not set up. Add ANTHROPIC_API_KEY to the server settings.': 'ਫੋਟੋ ਪੜ੍ਹਨਾ ਸੈੱਟ ਨਹੀਂ ਹੈ। ਸਰਵਰ ਸੈਟਿੰਗ ਵਿੱਚ ANTHROPIC_API_KEY ਪਾਓ।',
  'The photo reading key (ANTHROPIC_API_KEY) is wrong.': 'ਫੋਟੋ ਪੜ੍ਹਨ ਵਾਲੀ ਕੁੰਜੀ (ANTHROPIC_API_KEY) ਗਲਤ ਹੈ।',
  'Photo reading is busy. Please try again in a minute.': 'ਫੋਟੋ ਪੜ੍ਹਨਾ ਰੁੱਝਿਆ ਹੈ। ਇੱਕ ਮਿੰਟ ਬਾਅਦ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
  'Photo reading failed. Please try again.': 'ਫੋਟੋ ਨਹੀਂ ਪੜ੍ਹੀ ਗਈ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
  'The photo could not be read. Please try another photo.': 'ਫੋਟੋ ਨਹੀਂ ਪੜ੍ਹੀ ਗਈ। ਕੋਈ ਹੋਰ ਫੋਟੋ ਖਿੱਚੋ।',
  'The list is too long for one photo. Please photograph half the page at a time.': 'ਇੱਕ ਫੋਟੋ ਲਈ ਸੂਚੀ ਬਹੁਤ ਲੰਮੀ ਹੈ। ਅੱਧਾ-ਅੱਧਾ ਪੰਨਾ ਖਿੱਚੋ।',
  'a photo': 'ਫੋਟੋ',

  // server messages
  'Account not found': 'ਖਾਤਾ ਨਹੀਂ ਮਿਲਿਆ', 'Already set up': 'ਪਹਿਲਾਂ ਹੀ ਸੈੱਟ ਹੈ', 'Current password is wrong': 'ਮੌਜੂਦਾ ਪਾਸਵਰਡ ਗਲਤ ਹੈ',
  'Customer not found': 'ਗਾਹਕ ਨਹੀਂ ਮਿਲਿਆ', 'Entry not found': 'ਐਂਟਰੀ ਨਹੀਂ ਮਿਲੀ', 'Feed item not found': 'ਫੀਡ ਚੀਜ਼ ਨਹੀਂ ਮਿਲੀ',
  'For credit (udhaar), please choose the buyer from the list': 'ਉਧਾਰ ਲਈ ਸੂਚੀ ਵਿੱਚੋਂ ਖਰੀਦਦਾਰ ਚੁਣੋ',
  'Invalid JSON': 'ਗਲਤ ਬੇਨਤੀ', 'Invalid request': 'ਗਲਤ ਬੇਨਤੀ', 'Method not allowed': 'ਇਜਾਜ਼ਤ ਨਹੀਂ', 'Not allowed': 'ਇਜਾਜ਼ਤ ਨਹੀਂ',
  'Not found': 'ਨਹੀਂ ਮਿਲਿਆ',
  'Mobile number or PIN is wrong. Ask the dairy to set your PIN.': 'ਮੋਬਾਈਲ ਨੰਬਰ ਜਾਂ PIN ਗਲਤ ਹੈ। ਡੇਅਰੀ ਤੋਂ PIN ਪੁੱਛੋ।',
  'New password must be at least 4 characters': 'ਨਵਾਂ ਪਾਸਵਰਡ ਘੱਟੋ-ਘੱਟ 4 ਅੱਖਰਾਂ ਦਾ ਹੋਵੇ',
  'PIN must be 4 to 6 digits': 'PIN 4 ਤੋਂ 6 ਅੰਕਾਂ ਦਾ ਹੋਵੇ', 'Password must be at least 4 characters': 'ਪਾਸਵਰਡ ਘੱਟੋ-ਘੱਟ 4 ਅੱਖਰਾਂ ਦਾ ਹੋਵੇ',
  'Please choose both dates': 'ਦੋਵੇਂ ਤਾਰੀਖਾਂ ਚੁਣੋ', 'Please choose the feed item': 'ਫੀਡ ਚੀਜ਼ ਚੁਣੋ',
  'Please choose the person': 'ਗਾਹਕ ਚੁਣੋ', 'Please choose what the money was spent on': 'ਚੁਣੋ ਪੈਸੇ ਕਿਸ ਤੇ ਖਰਚੇ',
  'Please enter the dairy name': 'ਡੇਅਰੀ ਦਾ ਨਾਮ ਲਿਖੋ', 'Please enter the feed name': 'ਫੀਡ ਦਾ ਨਾਮ ਲਿਖੋ',
  'Please enter the name': 'ਨਾਮ ਲਿਖੋ', 'Please enter your mobile number': 'ਆਪਣਾ ਮੋਬਾਈਲ ਨੰਬਰ ਲਿਖੋ',
  'Please log in again': 'ਦੁਬਾਰਾ ਲੌਗਇਨ ਕਰੋ', 'Request too large': 'ਬੇਨਤੀ ਬਹੁਤ ਵੱਡੀ ਹੈ',
  'This mobile number is already used by another person': 'ਇਹ ਮੋਬਾਈਲ ਨੰਬਰ ਕਿਸੇ ਹੋਰ ਦਾ ਹੈ',
  'To add to account (cut from milk money), please choose the customer': 'ਖਾਤੇ ਵਿੱਚ ਪਾਉਣ ਲਈ ਗਾਹਕ ਚੁਣੋ',
  'To buy on account, please choose the supplier': 'ਉਧਾਰ ਖਰੀਦ ਲਈ ਸਪਲਾਇਰ ਚੁਣੋ',
  'Too many wrong attempts. Please try again after 15 minutes.': 'ਬਹੁਤ ਵਾਰ ਗਲਤ ਹੋਇਆ। 15 ਮਿੰਟ ਬਾਅਦ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
  'Wrong password': 'ਗਲਤ ਪਾਸਵਰਡ',
  // pieces used in "Please enter a valid …" / "Please choose …" messages
  'quantity (litres)': 'ਮਾਤਰਾ (ਲੀਟਰ)', 'rate': 'ਰੇਟ', 'amount': 'ਰਕਮ', 'quantity': 'ਮਾਤਰਾ', 'date': 'ਤਾਰੀਖ',
  'morning or evening': 'ਸਵੇਰ ਜਾਂ ਸ਼ਾਮ', 'cow or buffalo': 'ਗਾਂ ਜਾਂ ਮੱਝ', 'payment mode': 'ਭੁਗਤਾਨ ਦਾ ਤਰੀਕਾ',
  'cash or online': 'ਨਕਦ ਜਾਂ ਆਨਲਾਈਨ', 'paid or received': 'ਦਿੱਤੇ ਜਾਂ ਲਏ', 'house or business': 'ਘਰ ਜਾਂ ਕਾਰੋਬਾਰ',
  'who the milk went to': 'ਦੁੱਧ ਕਿਸ ਨੂੰ ਗਿਆ', 'a type': 'ਕਿਸਮ',
};

function getLang() {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'pa' || saved === 'en') return saved;
  } catch { /* ignore */ }
  return (navigator.language || '').toLowerCase().startsWith('pa') ? 'pa' : 'en';
}
function setLang(l) {
  try { localStorage.setItem('lang', l); } catch { /* ignore */ }
  document.documentElement.lang = l;
}

function t(s, vars) {
  let out = getLang() === 'pa' && PA[s] ? PA[s] : s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
}

// Server errors: exact text, or "Please enter a valid X" / "Please choose X" patterns.
function tError(msg) {
  if (getLang() !== 'pa') return msg;
  if (PA[msg]) return PA[msg];
  const line = /^Line (\d+): (.+)$/.exec(msg);
  if (line) return `ਲਾਈਨ ${line[1]}: ${tError(line[2])}`;
  let m = /^Please enter a valid (.+)$/.exec(msg);
  if (m) return `ਸਹੀ ${t(m[1])} ਭਰੋ`;
  m = /^Please choose a valid (.+)$/.exec(msg);
  if (m) return `ਸਹੀ ${t(m[1])} ਚੁਣੋ`;
  m = /^Please choose (.+)$/.exec(msg);
  if (m) return `${t(m[1])} ਚੁਣੋ`;
  return msg;
}
