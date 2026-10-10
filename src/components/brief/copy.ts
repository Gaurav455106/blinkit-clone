// ── Written copy for the brief: rival positioning and customer reviews (SPEC §4.2, §10) ──
// Reviews hint at positioning (and at which SKU earns its keep) without
// labelling a hero product (decision Q24).

/** One sentence per rival: how it positions itself and where it is strong. */
export const RIVAL_POSITIONING: Readonly<Record<string, string>> = {
  barkster: "The name most dog owners already know. Wide range, strong on the big searches like dog treats and dog food.",
  chewchamp: "Younger online brand that grows by bidding on other brands' names, yours included.",
  pawprice: "Value packs at the lowest shelf price. Wins shoppers who compare per-gram cost.",
  dermadew: "Dermatologist-led positioning and the default pick for serums. Holds the head skincare terms.",
  skintheory: "Brand that grew on Instagram. Spends a lot on banner ads to stay seen.",
  glowmart: "Budget basics in plain packaging. Undercuts on sunscreen and moisturiser.",
  nutricore: "Pharmacy-shelf supplements brand moving onto Blinkit. Trusted, but new to 10-minute delivery.",
  wellrx: "Online pharmacy listings that show up on generic vitamin searches with a small budget.",
  babysoft: "The brand hospitals hand out samples of. Parents trust it and it holds wipes and diaper searches.",
  happynest: "Natural-ingredients baby care with a loyal following. Pushes rash cream and lotions.",
  budgetbub: "Large packs at low prices. Strong when parents stock up.",
  crunchco: "National snack brand with a huge budget. Owns chips, snacks and namkeen.",
  snacksutra: "Healthy-snacking challenger. Goes after makhana searches in bursts, often around evening cricket.",
  namkeennow: "Regional namkeen and nuts at sharp prices. Cuts price when it needs volume.",
  petnest: "Established pet accessories range. Shows up on most leash and bowl searches.",
  wagwear: "Design-led accessories that sell on looks. Spends on Stories and “you may also like” ads.",
  ironwhey: "The biggest whey brand in gyms. Defends protein powder and whey protein hard.",
  wheynation: "Fast-growing challenger that bids on your brand name and runs aggressive bursts.",
  "profit-basics": "Entry-level protein and bars at budget prices. Known to cut prices mid-month.",
};

export interface ReviewSnippet {
  quote: string;
  author: string;
  city: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

export const BRAND_REVIEWS: Readonly<Record<string, readonly ReviewSnippet[]>> = {
  henlo: [
    { quote: "My beagle goes mad for the chicken jerky. Pricier than the supermarket brand but the ingredient list is short.", author: "Ananya R.", city: "Bengaluru", rating: 5 },
    { quote: "Dental chews last him about two minutes. Good, but I go through a pack fast.", author: "Karthik M.", city: "Hyderabad", rating: 4 },
    { quote: "Puppy biscuits are fine. Honestly I can't tell them apart from cheaper ones.", author: "Sneha P.", city: "Pune", rating: 3 },
  ],
  glow: [
    { quote: "The vitamin C serum didn't sting like others I've tried. Bought it after seeing it twice on the home screen.", author: "Ritika S.", city: "Mumbai", rating: 5 },
    { quote: "Sunscreen leaves no white cast, which matters for me. Wish there was a smaller trial size.", author: "Meher K.", city: "Delhi", rating: 4 },
    { quote: "Never heard of the brand before. Took a chance because the reviews looked real.", author: "Aishwarya N.", city: "Bengaluru", rating: 4 },
  ],
  vitaboost: [
    { quote: "Didn't know I could get supplements delivered in ten minutes. Ordered the iron tablets on my doctor's advice.", author: "Pooja D.", city: "Mumbai", rating: 5 },
    { quote: "Omega-3 is decent. I usually buy from the chemist, this was just convenient.", author: "Rahul V.", city: "Hyderabad", rating: 4 },
    { quote: "Hard to judge a multivitamin after one month. Packaging feels premium.", author: "Neha G.", city: "Bengaluru", rating: 3 },
  ],
  tinybuddy: [
    { quote: "The rash cream worked overnight. I keep a spare now and order it before my morning coffee.", author: "Shruti A.", city: "Gurugram", rating: 5 },
    { quote: "Wipes are thick and don't dry out. We go through a pack every few days.", author: "Vikram T.", city: "Noida", rating: 4 },
    { quote: "Shampoo is gentle but smells stronger than I'd like for a newborn.", author: "Farah Q.", city: "Delhi", rating: 3 },
  ],
  munchbox: [
    { quote: "Peri peri makhana is my evening match snack now. Feels less guilty than chips.", author: "Aditya J.", city: "Mumbai", rating: 5 },
    { quote: "Nuts and seeds mix is good value for the quality. Not cheap, but filling.", author: "Hetal B.", city: "Ahmedabad", rating: 4 },
    { quote: "The multigrain chips taste like every other chips packet. Fine for ₹49.", author: "Rohan K.", city: "Bengaluru", rating: 3 },
  ],
  pawlife: [
    { quote: "Compared three leashes before buying this one. Stitching looks like it'll last.", author: "Nikhil S.", city: "Hyderabad", rating: 5 },
    { quote: "The harness fits well once adjusted. Took a while to decide, it's not a small spend.", author: "Divya R.", city: "Bengaluru", rating: 4 },
    { quote: "Bowl set is solid steel. Saw it as a suggestion while buying dog food.", author: "Imran H.", city: "Mumbai", rating: 4 },
  ],
  fuelup: [
    { quote: "The chocolate whey mixes without lumps and the label matches the lab test I looked up.", author: "Arjun N.", city: "Bengaluru", rating: 5 },
    { quote: "Plant protein is a bit chalky but it's the only vegan one my gym friends rate.", author: "Kavya L.", city: "Mumbai", rating: 4 },
    { quote: "The bar is okay as a snack. Small for the price, I grab it only when I forget lunch.", author: "Siddharth P.", city: "Delhi", rating: 3 },
  ],
};
