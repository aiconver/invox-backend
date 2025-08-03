// models/UserFormTemplate.ts

import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  DataTypes,
} from "sequelize";
import { sequelize } from "..";
import FormTemplate from "./formTemplate";
import User from "./user";

export class UserFormTemplate extends Model<
  InferAttributes<UserFormTemplate>,
  InferCreationAttributes<UserFormTemplate>
> {
  declare id: CreationOptional<number>;

  declare userId: ForeignKey<User["id"]>;
  declare formTemplateId: ForeignKey<FormTemplate["id"]>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

UserFormTemplate.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    formTemplateId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: "UserFormTemplate",
    tableName: "user_form_templates",
  }
);


User.belongsToMany(FormTemplate, {
  through: UserFormTemplate,
  foreignKey: "userId",
  as: "assignedTemplates",
});

FormTemplate.belongsToMany(User, {
  through: UserFormTemplate,
  foreignKey: "formTemplateId",
  as: "assignedUsers",
});
