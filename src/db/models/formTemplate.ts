import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "..";

export class FormTemplate extends Model<
  InferAttributes<FormTemplate>,
  InferCreationAttributes<FormTemplate>
> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare department: string;
  declare structure: object;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

FormTemplate.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    department: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    structure: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: "FormTemplate",
    tableName: "form_templates",
  }
);

export default FormTemplate;
