import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "..";
import { ProcessingType } from "./enums";
import Form from "./form";

export class FormTemplate extends Model<
  InferAttributes<FormTemplate>,
  InferCreationAttributes<FormTemplate>
> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare department: string;
  declare processingType: ProcessingType;
  declare domainKnowledge: string;
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
    processingType: {
      type: DataTypes.ENUM(...Object.values(ProcessingType)),
      allowNull: false,
    },
    domainKnowledge:{
      type: DataTypes.STRING(2000),
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

FormTemplate.hasMany(Form, { 
  foreignKey: "templateId",
  as: "forms"
});

Form.belongsTo(FormTemplate, { 
  foreignKey: "templateId",
  as: "template"
});

export default FormTemplate;
