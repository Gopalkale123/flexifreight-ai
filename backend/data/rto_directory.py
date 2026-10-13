"""
Comprehensive Indian Regional Transport Office (RTO) and State Directory.
Used by the FlexiFreight Built-in RTO Intelligence Engine for offline validation
of vehicle registration certificates (RC), number plates, and driving licenses (DL).
"""

# 28 States and 8 Union Territories
STATE_CODES = {
    "AP": "Andhra Pradesh",
    "AR": "Arunachal Pradesh",
    "AS": "Assam",
    "BR": "Bihar",
    "CG": "Chhattisgarh",
    "CH": "Chandigarh",
    "DD": "Daman and Diu",
    "DL": "Delhi",
    "DN": "Dadra and Nagar Haveli",
    "GA": "Goa",
    "GJ": "Gujarat",
    "HR": "Haryana",
    "HP": "Himachal Pradesh",
    "JH": "Jharkhand",
    "JK": "Jammu and Kashmir",
    "KA": "Karnataka",
    "KL": "Kerala",
    "LA": "Ladakh",
    "LD": "Lakshadweep",
    "MH": "Maharashtra",
    "ML": "Meghalaya",
    "MN": "Manipur",
    "MP": "Madhya Pradesh",
    "MZ": "Mizoram",
    "NL": "Nagaland",
    "OD": "Odisha",
    "PB": "Punjab",
    "PY": "Puducherry",
    "RJ": "Rajasthan",
    "SK": "Sikkim",
    "TN": "Tamil Nadu",
    "TR": "Tripura",
    "TS": "Telangana",
    "UK": "Uttarakhand",
    "UP": "Uttar Pradesh",
    "WB": "West Bengal",
}

# RTO Directory: Code -> (State Name, District/City, Office Name)
RTO_DIRECTORY = {
    # ------------------ MAHARASHTRA (MH) ------------------
    "MH01": ("Maharashtra", "Mumbai South", "Mumbai South RTO (Tardeo)"),
    "MH02": ("Maharashtra", "Mumbai West", "Mumbai West RTO (Andheri)"),
    "MH03": ("Maharashtra", "Mumbai East", "Mumbai East RTO (Wadala)"),
    "MH04": ("Maharashtra", "Thane", "Thane RTO"),
    "MH05": ("Maharashtra", "Thane", "Kalyan RTO"),
    "MH06": ("Maharashtra", "Raigad", "Pen RTO (Raigad)"),
    "MH07": ("Maharashtra", "Sindhudurg", "Sindhudurg RTO (Oros)"),
    "MH08": ("Maharashtra", "Ratnagiri", "Ratnagiri RTO"),
    "MH09": ("Maharashtra", "Kolhapur", "Kolhapur RTO"),
    "MH10": ("Maharashtra", "Sangli", "Sangli RTO"),
    "MH11": ("Maharashtra", "Satara", "Satara RTO"),
    "MH12": ("Maharashtra", "Pune", "Pune RTO (Sangamwadi)"),
    "MH13": ("Maharashtra", "Solapur", "Solapur RTO"),
    "MH14": ("Maharashtra", "Pune", "Pimpri-Chinchwad RTO"),
    "MH15": ("Maharashtra", "Nashik", "Nashik RTO"),
    "MH16": ("Maharashtra", "Ahmednagar", "Ahilyanagar / Ahmednagar RTO"),
    "MH17": ("Maharashtra", "Ahmednagar", "Shrirampur RTO"),
    "MH18": ("Maharashtra", "Dhule", "Dhule RTO"),
    "MH19": ("Maharashtra", "Jalgaon", "Jalgaon RTO"),
    "MH20": ("Maharashtra", "Chhatrapati Sambhajinagar", "Chhatrapati Sambhajinagar / Aurangabad RTO"),
    "MH21": ("Maharashtra", "Jalna", "Jalna RTO"),
    "MH22": ("Maharashtra", "Parbhani", "Parbhani RTO"),
    "MH23": ("Maharashtra", "Beed", "Beed RTO"),
    "MH24": ("Maharashtra", "Latur", "Latur RTO"),
    "MH25": ("Maharashtra", "Dharashiv", "Dharashiv / Osmanabad RTO"),
    "MH26": ("Maharashtra", "Nanded", "Nanded RTO"),
    "MH27": ("Maharashtra", "Amravati", "Amravati RTO"),
    "MH28": ("Maharashtra", "Buldhana", "Buldhana RTO"),
    "MH29": ("Maharashtra", "Yavatmal", "Yavatmal RTO"),
    "MH30": ("Maharashtra", "Akola", "Akola RTO"),
    "MH31": ("Maharashtra", "Nagpur", "Nagpur City RTO"),
    "MH32": ("Maharashtra", "Wardha", "Wardha RTO"),
    "MH33": ("Maharashtra", "Gadchiroli", "Gadchiroli RTO"),
    "MH34": ("Maharashtra", "Chandrapur", "Chandrapur RTO"),
    "MH35": ("Maharashtra", "Gondia", "Gondia RTO"),
    "MH36": ("Maharashtra", "Bhandara", "Bhandara RTO"),
    "MH37": ("Maharashtra", "Washim", "Washim RTO"),
    "MH38": ("Maharashtra", "Hingoli", "Hingoli RTO"),
    "MH39": ("Maharashtra", "Nandurbar", "Nandurbar RTO"),
    "MH40": ("Maharashtra", "Nagpur", "Nagpur Rural RTO"),
    "MH41": ("Maharashtra", "Nashik", "Malegaon RTO"),
    "MH42": ("Maharashtra", "Pune", "Baramati RTO"),
    "MH43": ("Maharashtra", "Thane", "Navi Mumbai RTO (Vashi)"),
    "MH44": ("Maharashtra", "Beed", "Ambejogai RTO"),
    "MH45": ("Maharashtra", "Solapur", "Akluj RTO"),
    "MH46": ("Maharashtra", "Raigad", "Panvel RTO"),
    "MH47": ("Maharashtra", "Mumbai Suburban", "Mumbai North RTO (Borivali)"),
    "MH48": ("Maharashtra", "Palghar", "Vasai-Virar / Palghar RTO"),
    "MH49": ("Maharashtra", "Nagpur", "Nagpur East RTO"),
    "MH50": ("Maharashtra", "Satara", "Karad RTO"),
    "MH51": ("Maharashtra", "Nashik", "Nashik Rural RTO"),
    "MH52": ("Maharashtra", "Pune", "Phaltan / Shirur RTO"),

    # ------------------ DELHI (DL) ------------------
    "DL01": ("Delhi", "North Delhi", "Mall Road RTO"),
    "DL02": ("Delhi", "New Delhi", "Tilak Marg RTO"),
    "DL03": ("Delhi", "South Delhi", "Sheikh Sarai RTO"),
    "DL04": ("Delhi", "West Delhi", "Janakpuri RTO"),
    "DL05": ("Delhi", "North East Delhi", "Loni Road RTO"),
    "DL06": ("Delhi", "Central Delhi", "Sarai Kale Khan RTO"),
    "DL07": ("Delhi", "East Delhi", "Mayur Vihar RTO"),
    "DL08": ("Delhi", "North West Delhi", "Wazirpur RTO"),
    "DL09": ("Delhi", "South West Delhi", "Palam RTO"),
    "DL10": ("Delhi", "West Delhi", "Raja Garden RTO"),
    "DL11": ("Delhi", "North West Delhi", "Rohini RTO"),
    "DL12": ("Delhi", "South West Delhi", "Vasant Vihar RTO"),
    "DL13": ("Delhi", "East Delhi", "Surajmal Vihar RTO"),
    "DL14": ("Delhi", "Shahdara", "Shahdara RTO"),

    # ------------------ GUJARAT (GJ) ------------------
    "GJ01": ("Gujarat", "Ahmedabad", "Ahmedabad West RTO (Subhash Bridge)"),
    "GJ02": ("Gujarat", "Mehsana", "Mehsana RTO"),
    "GJ03": ("Gujarat", "Rajkot", "Rajkot RTO"),
    "GJ04": ("Gujarat", "Bhavnagar", "Bhavnagar RTO"),
    "GJ05": ("Gujarat", "Surat", "Surat RTO"),
    "GJ06": ("Gujarat", "Vadodara", "Vadodara RTO"),
    "GJ07": ("Gujarat", "Kheda", "Nadiad RTO"),
    "GJ08": ("Gujarat", "Banaskantha", "Palanpur RTO"),
    "GJ09": ("Gujarat", "Sabarkantha", "Himmatnagar RTO"),
    "GJ10": ("Gujarat", "Jamnagar", "Jamnagar RTO"),
    "GJ11": ("Gujarat", "Junagadh", "Junagadh RTO"),
    "GJ12": ("Gujarat", "Kutch", "Bhuj RTO"),
    "GJ13": ("Gujarat", "Surendranagar", "Surendranagar RTO"),
    "GJ14": ("Gujarat", "Amreli", "Amreli RTO"),
    "GJ15": ("Gujarat", "Valsad", "Valsad RTO"),
    "GJ16": ("Gujarat", "Bharuch", "Bharuch RTO"),
    "GJ17": ("Gujarat", "Panchmahal", "Godhra RTO"),
    "GJ18": ("Gujarat", "Gandhinagar", "Gandhinagar RTO"),
    "GJ19": ("Gujarat", "Navsari", "Navsari RTO"),
    "GJ20": ("Gujarat", "Dahod", "Dahod RTO"),
    "GJ21": ("Gujarat", "Tapi", "Vyara RTO"),
    "GJ22": ("Gujarat", "Narmada", "Rajpipla RTO"),
    "GJ23": ("Gujarat", "Anand", "Anand RTO"),
    "GJ24": ("Gujarat", "Patan", "Patan RTO"),
    "GJ25": ("Gujarat", "Porbandar", "Porbandar RTO"),
    "GJ26": ("Gujarat", "Dang", "Ahwa RTO"),
    "GJ27": ("Gujarat", "Ahmedabad", "Ahmedabad East RTO (Vastral)"),
    "GJ28": ("Gujarat", "Surat", "Surat Rural RTO (Pal)"),

    # ------------------ KARNATAKA (KA) ------------------
    "KA01": ("Karnataka", "Bengaluru Urban", "Bengaluru Central RTO (Koramangala)"),
    "KA02": ("Karnataka", "Bengaluru Urban", "Bengaluru West RTO (Rajajinagar)"),
    "KA03": ("Karnataka", "Bengaluru Urban", "Bengaluru East RTO (Indiranagar)"),
    "KA04": ("Karnataka", "Bengaluru Urban", "Bengaluru North RTO (Yeshwanthpur)"),
    "KA05": ("Karnataka", "Bengaluru Urban", "Bengaluru South RTO (Jayanagar)"),
    "KA06": ("Karnataka", "Tumakuru", "Tumakuru RTO"),
    "KA07": ("Karnataka", "Kolar", "Kolar RTO"),
    "KA08": ("Karnataka", "Kolar", "KGF RTO"),
    "KA09": ("Karnataka", "Mysuru", "Mysuru West RTO"),
    "KA10": ("Karnataka", "Chamarajanagar", "Chamarajanagar RTO"),
    "KA11": ("Karnataka", "Mandya", "Mandya RTO"),
    "KA12": ("Karnataka", "Kodagu", "Madikeri RTO"),
    "KA13": ("Karnataka", "Hassan", "Hassan RTO"),
    "KA14": ("Karnataka", "Shivamogga", "Shivamogga RTO"),
    "KA15": ("Karnataka", "Shivamogga", "Sagara RTO"),
    "KA16": ("Karnataka", "Chitradurga", "Chitradurga RTO"),
    "KA17": ("Karnataka", "Davanagere", "Davanagere RTO"),
    "KA18": ("Karnataka", "Chikkamagaluru", "Chikkamagaluru RTO"),
    "KA19": ("Karnataka", "Dakshina Kannada", "Mangaluru RTO"),
    "KA20": ("Karnataka", "Udupi", "Udupi RTO"),
    "KA21": ("Karnataka", "Dakshina Kannada", "Puttur RTO"),
    "KA22": ("Karnataka", "Belagavi", "Belagavi RTO"),
    "KA23": ("Karnataka", "Belagavi", "Chikkodi RTO"),
    "KA24": ("Karnataka", "Belagavi", "Bailhongal RTO"),
    "KA25": ("Karnataka", "Dharwad", "Hubballi-Dharwad RTO"),
    "KA51": ("Karnataka", "Bengaluru Urban", "Electronic City RTO"),
    "KA53": ("Karnataka", "Bengaluru Urban", "K.R. Puram RTO"),

    # ------------------ MADHYA PRADESH (MP) ------------------
    "MP04": ("Madhya Pradesh", "Bhopal", "Bhopal RTO"),
    "MP07": ("Madhya Pradesh", "Gwalior", "Gwalior RTO"),
    "MP09": ("Madhya Pradesh", "Indore", "Indore RTO"),
    "MP20": ("Madhya Pradesh", "Jabalpur", "Jabalpur RTO"),
    "MP43": ("Madhya Pradesh", "Ratlam", "Ratlam RTO"),
    "MP48": ("Madhya Pradesh", "Betul", "Betul RTO"),
    "MP53": ("Madhya Pradesh", "Chhindwara", "Chhindwara RTO"),

    # ------------------ RAJASTHAN (RJ) ------------------
    "RJ14": ("Rajasthan", "Jaipur", "Jaipur South RTO"),
    "RJ45": ("Rajasthan", "Jaipur", "Jaipur North RTO"),
    "RJ19": ("Rajasthan", "Jodhpur", "Jodhpur RTO"),
    "RJ27": ("Rajasthan", "Udaipur", "Udaipur RTO"),
    "RJ20": ("Rajasthan", "Kota", "Kota RTO"),
    "RJ02": ("Rajasthan", "Alwar", "Alwar RTO"),
    "RJ05": ("Rajasthan", "Bharatpur", "Bharatpur RTO"),
    "RJ10": ("Rajasthan", "Churu", "Churu RTO"),

    # ------------------ UTTAR PRADESH (UP) ------------------
    "UP14": ("Uttar Pradesh", "Ghaziabad", "Ghaziabad RTO"),
    "UP16": ("Uttar Pradesh", "Gautam Buddha Nagar", "Noida RTO"),
    "UP32": ("Uttar Pradesh", "Lucknow", "Lucknow RTO"),
    "UP70": ("Uttar Pradesh", "Prayagraj", "Prayagraj / Allahabad RTO"),
    "UP78": ("Uttar Pradesh", "Kanpur Nagar", "Kanpur RTO"),
    "UP65": ("Uttar Pradesh", "Varanasi", "Varanasi RTO"),
    "UP80": ("Uttar Pradesh", "Agra", "Agra RTO"),
    "UP81": ("Uttar Pradesh", "Aligarh", "Aligarh RTO"),
    "UP85": ("Uttar Pradesh", "Mathura", "Mathura RTO"),

    # ------------------ HARYANA (HR) ------------------
    "HR01": ("Haryana", "Ambala", "Ambala RTO"),
    "HR03": ("Haryana", "Panchkula", "Panchkula RTO"),
    "HR06": ("Haryana", "Panipat", "Panipat RTO"),
    "HR10": ("Haryana", "Sonipat", "Sonipat RTO"),
    "HR26": ("Haryana", "Gurugram", "Gurugram North RTO"),
    "HR55": ("Haryana", "Gurugram", "Gurugram South RTO"),
    "HR51": ("Haryana", "Faridabad", "Faridabad RTO"),
    "HR70": ("Haryana", "Chandigarh", "Chandigarh / Transport HQ"),

    # ------------------ TELANGANA (TS) ------------------
    "TS07": ("Telangana", "Ranga Reddy", "Attapur / Ranga Reddy RTO"),
    "TS08": ("Telangana", "Medchal", "Medchal-Malkajgiri RTO"),
    "TS09": ("Telangana", "Hyderabad", "Hyderabad Central (Khairatabad)"),
    "TS10": ("Telangana", "Hyderabad", "Secunderabad RTO"),
    "TS11": ("Telangana", "Hyderabad", "Malakpet RTO"),

    # ------------------ ANDHRA PRADESH (AP) ------------------
    "AP07": ("Andhra Pradesh", "Guntur", "Guntur RTO"),
    "AP16": ("Andhra Pradesh", "Krishna", "Vijayawada RTO"),
    "AP26": ("Andhra Pradesh", "Nellore", "Nellore RTO"),
    "AP31": ("Andhra Pradesh", "Visakhapatnam", "Visakhapatnam RTO"),
    "AP39": ("Andhra Pradesh", "Tirupati", "Tirupati RTO"),

    # ------------------ TAMIL NADU (TN) ------------------
    "TN01": ("Tamil Nadu", "Chennai", "Chennai Central RTO (Ayanavaram)"),
    "TN02": ("Tamil Nadu", "Chennai", "Chennai North West RTO (Anna Nagar)"),
    "TN05": ("Tamil Nadu", "Chennai", "Chennai North RTO (Kolathur)"),
    "TN07": ("Tamil Nadu", "Chennai", "Chennai South RTO (Thiruvanmiyur)"),
    "TN09": ("Tamil Nadu", "Chennai", "Chennai West RTO (K.K. Nagar)"),
    "TN10": ("Tamil Nadu", "Chennai", "Chennai South West RTO (Virugambakkam)"),
    "TN37": ("Tamil Nadu", "Coimbatore", "Coimbatore South RTO"),
    "TN38": ("Tamil Nadu", "Coimbatore", "Coimbatore North RTO"),
    "TN58": ("Tamil Nadu", "Madurai", "Madurai South RTO"),
    "TN45": ("Tamil Nadu", "Tiruchirappalli", "Tiruchirappalli RTO"),
    "TN30": ("Tamil Nadu", "Salem", "Salem West RTO"),

    # ------------------ PUNJAB (PB) ------------------
    "PB02": ("Punjab", "Amritsar", "Amritsar RTO"),
    "PB08": ("Punjab", "Jalandhar", "Jalandhar RTO"),
    "PB10": ("Punjab", "Ludhiana", "Ludhiana RTO"),
    "PB11": ("Punjab", "Patiala", "Patiala RTO"),
    "PB65": ("Punjab", "SAS Nagar", "Mohali RTO"),

    # ------------------ WEST BENGAL (WB) ------------------
    "WB01": ("West Bengal", "Kolkata", "Kolkata North RTO (Beltala)"),
    "WB02": ("West Bengal", "Kolkata", "Kolkata Central RTO"),
    "WB19": ("West Bengal", "South 24 Parganas", "Alipore RTO"),
    "WB24": ("West Bengal", "North 24 Parganas", "Barrackpore RTO"),
    "WB41": ("West Bengal", "Paschim Bardhaman", "Durgapur RTO"),
    "WB73": ("West Bengal", "Darjeeling", "Siliguri RTO"),

    # ------------------ KERALA (KL) ------------------
    "KL01": ("Kerala", "Thiruvananthapuram", "Thiruvananthapuram RTO"),
    "KL07": ("Kerala", "Ernakulam", "Ernakulam / Kochi RTO"),
    "KL08": ("Kerala", "Thrissur", "Thrissur RTO"),
    "KL11": ("Kerala", "Kozhikode", "Kozhikode RTO"),
}


def lookup_rto(code: str):
    """
    Looks up an Indian RTO by its 4-character code (e.g. MH12, DL01, GJ05).
    Falls back to state identification if RTO sub-office is not explicitly listed.
    """
    code_clean = code.strip().upper()
    if code_clean in RTO_DIRECTORY:
        return RTO_DIRECTORY[code_clean]
    
    # Fallback to state level
    state_prefix = code_clean[:2]
    if state_prefix in STATE_CODES:
        state_name = STATE_CODES[state_prefix]
        return (state_name, f"{state_name} Region", f"{state_name} Transport Department ({code_clean})")
    
    return None
