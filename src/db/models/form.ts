import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "..";

export class Form extends Model<
  InferAttributes<Form>,
  InferCreationAttributes<Form>
> {
  declare id: CreationOptional<string>;
  declare templateId: string;
  declare values: object;

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
    values: {
      type: DataTypes.JSONB,
      allowNull: false,
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

export default Form;
