INSERT INTO parking_spaces
(owner_id, name, description, address, city, postal_code, access_gate,
 latitude, longitude, parking_type, capacity, standard_bays, compact_bays,
 ev_bays, motorcycle_bays, scooter_bays, price_per_hour, daily_max,
 schedule_type, amenities, is_available, status)
VALUES
(
'd9976e92-4a47-46ef-8651-b9d3c0a9e015',
'Andheri Metro Parking',
'Secure parking near Andheri Metro Station',
'Andheri East Metro Station, Andheri East',
'Mumbai','400069','Main Gate',
19.1197,72.8468,'covered',
50,25,10,5,5,5,60,400,'24-7',
'["CCTV","Security","EV Charging","Covered Parking"]'::jsonb,
true,'active'
),
(
'd9976e92-4a47-46ef-8651-b9d3c0a9e015',
'Bandra West Parking Hub',
'Convenient parking in Bandra West',
'Hill Road, Bandra West',
'Mumbai','400050','Main Entrance',
19.0607,72.8362,'multi_level',
80,40,20,8,6,6,80,550,'24-7',
'["CCTV","Security","Valet","EV Charging"]'::jsonb,
true,'active'
),
(
'd9976e92-4a47-46ef-8651-b9d3c0a9e015',
'Powai Lake Parking',
'Large parking facility near Powai Lake',
'Powai Lake Road, Powai',
'Mumbai','400076','Lake Road Gate',
19.1240,72.9049,'open',
100,55,20,5,10,10,40,300,'24-7',
'["CCTV","Security","Well Lit"]'::jsonb,
true,'active'
),
(
'd9976e92-4a47-46ef-8651-b9d3c0a9e015',
'Juhu Parking Centre',
'Secure parking close to Juhu Beach',
'Juhu Tara Road, Juhu',
'Mumbai','400049','Main Gate',
19.0988,72.8267,'covered',
60,30,15,5,5,5,70,500,'24-7',
'["CCTV","Security","Covered Parking","EV Charging"]'::jsonb,
true,'active'
),
(
'd9976e92-4a47-46ef-8651-b9d3c0a9e015',
'Lower Parel Parking',
'Multi-level parking near Lower Parel',
'Senapati Bapat Marg, Lower Parel',
'Mumbai','400013','Main Entrance',
18.9988,72.8258,'multi_level',
120,60,30,10,10,10,90,600,'24-7',
'["CCTV","Security","Valet","EV Charging","Covered Parking"]'::jsonb,
true,'active'
);