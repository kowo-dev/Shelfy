package com.shelfy.api.config;

import org.hibernate.boot.model.FunctionContributions;
import org.hibernate.boot.model.FunctionContributor;
import org.hibernate.type.StandardBasicTypes;

public class UnaccentFunctionContributor implements FunctionContributor {

  @Override
  public void contributeFunctions(FunctionContributions functions) {
    functions
        .getFunctionRegistry()
        .registerPattern(
            "unaccent",
            "unaccent(?1)",
            functions
                .getTypeConfiguration()
                .getBasicTypeRegistry()
                .resolve(StandardBasicTypes.STRING));
  }
}
