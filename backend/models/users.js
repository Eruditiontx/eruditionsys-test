function defineUser(sequelize, DataTypes) {
  const User = sequelize.define(
    'User',
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      avatarPath: {
        type: DataTypes.STRING,
      },
      locale: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
    },
    {
      underscored: true,
      // The password hash is never loaded unless a query asks for it with
      // User.scope('withPassword'), so it cannot end up in a response by accident.
      defaultScope: {
        attributes: { exclude: ['password'] },
      },
      scopes: {
        withPassword: {},
      },
    }
  );

  User.associate = (models) => {
    User.hasMany(models.Project, { foreignKey: 'userId' });
  };

  return User;
}

export default defineUser;
