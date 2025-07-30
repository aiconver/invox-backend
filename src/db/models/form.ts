import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "..";
import User from "./user";

export class Form extends Model<
  InferAttributes<Form>,
  InferCreationAttributes<Form>
> {
  declare id: CreationOptional<string>;
  declare templateId: string;
  declare answers: object;

  declare createdBy: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Form.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "form_templates",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    answers: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
     createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users", // assumes a users table exists
        key: "id",
      },
      onDelete: "CASCADE",
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: "Form",
    tableName: "forms",
  }
);

Form.belongsTo(User, {
  foreignKey: "createdBy",
  as: "creator",
});


export default Form;
