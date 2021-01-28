const Sequelize = require('sequelize');
const { STRING } = Sequelize;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || 'postgres://localhost/acme_db',
  config
);

const User = conn.define('user', {
  username: STRING,
  password: STRING,
});

User.addHook('beforeSave', async function (user) {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

User.byToken = async (token) => {
  try {
    const { id } = jwt.verify(token, process.env.JWT);
    const user = await User.findByPk(id);
    if (user) {
      return user;
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });
  if (user && (await bcrypt.compare(password, user.password))) {
    // return user.id;
    const token = jwt.sign({ id: user.id }, process.env.JWT);
    // console.log(token);
    return token;
  }
  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

const Note = conn.define('note', {
  text: STRING,
});
Note.belongsTo(User);
User.hasMany(Note);

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw' },
    { username: 'moe', password: 'moe_pw' },
    { username: 'larry', password: 'larry_pw' },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );

  const notes = [
    { text: 'lucynote' },
    { text: 'moenote' },
    { text: 'larrynote' },
  ];
  const [lucynote, moenote, larrynote] = await Promise.all(
    notes.map((note) => Note.create(note))
  );

  lucynote.userId = lucy.id;
  await lucynote.save();

  moenote.userId = moe.id;
  await moenote.save();

  larrynote.userId = larry.id;
  await larrynote.save();

  return {
    users: {
      lucy,
      moe,
      larry,
    },
    notes: {
      lucynote,
      moenote,
      larrynote,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
