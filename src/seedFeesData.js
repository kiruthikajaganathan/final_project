// seedFeesData.js
const mongoose = require('mongoose');
const { Fees } = require('./mongo');

const mongoURI = 'mongodb://localhost:27017/LoginFormPractice';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB for seeding...');
    const count = await Fees.countDocuments();
    if (count === 0) {
      const defaultFeesData = new Fees({
        tuition: [
          { branch: "B.Tech. (AIDS)", fg: "40000", nonFg: "65000", gq: "65000", mq: "65000" },
          { branch: "B.Tech. (IT)", fg: "30000", nonFg: "55000", gq: "55000", mq: "55000" },
          { branch: "B.E. (CSE)", fg: "30000", nonFg: "55000", gq: "55000", mq: "35000" },
          { branch: "B.E. (ECE)", fg: "20000", nonFg: "45000", gq: "45000", mq: "45000" },
          { branch: "B.Tech. (AGRI)", fg: "15000", nonFg: "40000", gq: "40000", mq: "40000" },
          { branch: "B.E. (MECH/MTS)", fg: "15000", nonFg: "40000", gq: "40000", mq: "40000" }
        ],
        hostel: [
          { branch: "B.Tech. (AIDS)", bcMbc: "50000", scSt: "35000" },
          { branch: "B.Tech. (IT)", bcMbc: "50000", scSt: "45000" },
          { branch: "B.E. (CSE)", bcMbc: "50000", scSt: "45000" },
          { branch: "B.E. (ECE)", bcMbc: "50000", scSt: "35000" },
          { branch: "B.Tech. (AGRI)", bcMbc: "50000", scSt: "30000" },
          { branch: "B.E. (MECH/MTS)", bcMbc: "50000", scSt: "30000" }
        ]
      });
      await defaultFeesData.save();
      console.log('Default fees data inserted successfully!');
    } else {
      console.log('Fees collection is not empty.');
    }
  })
  .catch((err) => console.error('Error seeding database:', err))
  .finally(() => mongoose.disconnect());