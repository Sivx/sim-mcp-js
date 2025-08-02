/* sim-mcp
testTypes(messages?: optional, fruit: union, age?: optional, active?: optional, score?: default, items?: optional, note?: optional, mode: union, country: string, zip: string, size?: default, favoriteColor?: default) -> text
@Type and option demo
- messages: JSON array of messages
- fruit: Pick a fruit Choices: apple, banana, pear
- age: User age
- active: Is active
- score: A float with default (default: 5)
- items: Array of strings
- note: Optional note
- mode: Enum required Choices: auto, manual
- country: Country required string
- zip: Zip code (5 digits, required, regex) Regex: /^\d{5}$/
- size: Int enum w/default Choices: 1, 2, 3 (default: 2)
- favoriteColor: Enum w/default, optional Choices: red, green, blue (default: blue)
*/
import sim_mcp from "./sim-mcp.js";
sim_mcp.start("test-server@1.0.0", {
  "testTypes@Type and option demo": sim_mcp.tool(
    ({
      messages = "[]",
      fruit,
      age,
      active,
      score,
      items,
      note,
      mode,
      country,
      zip,
      size,
      favoriteColor,
    }) => {
      return {
        messages: JSON.parse(
          messages.length && messages.length > 0 ? messages : "[]"
        ),
        fruit,
        age,
        active,
        score,
        items,
        note,
        mode,
        country,
        zip,
        size,
        favoriteColor,
      };
    },
    [
      "messages:json@JSON array of messages",
      "fruit!{apple,banana,pear}@Pick a fruit",
      "age:int@User age",
      "active:boolean@Is active",
      "score:number=5@A float with default",
      "items:string[]@Array of strings",
      "note@Optional note",
      "mode!{auto,manual}@Enum required",
      "country!@Country required string",
      "zip!:/^\\d{5}$/@Zip code (5 digits, required, regex)",
      "size:int{1,2,3}=2@Int enum w/default",
      "favoriteColor:{red,green,blue}=blue@Enum w/default, optional",
    ]
  ),
});
/* mcp v2 json
[
  {
    "name": "testTypes",
    "description": "Type and option demo",
    "inputSchema": {
      "type": "object",
      "properties": {
        "messages": {
          "type": "string"
        },
        "fruit": {
          "type": "string",
          "description": "Pick a fruit Choices: apple, banana, pear"
        },
        "age": {
          "type": "integer"
        },
        "active": {
          "type": "boolean"
        },
        "score": {
          "type": "number",
          "default": 5
        },
        "items": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "note": {
          "type": "string"
        },
        "mode": {
          "type": "string",
          "description": "Enum required Choices: auto, manual"
        },
        "country": {
          "type": "string",
          "description": "Country required string"
        },
        "zip": {
          "type": "string",
          "description": "Zip code (5 digits, required, regex) Regex: /^\\d{5}$/",
          "pattern": "^\\d{5}$"
        },
        "size": {
          "type": "string",
          "default": "2"
        },
        "favoriteColor": {
          "type": "string",
          "default": "blue"
        }
      },
      "required": [
        "fruit",
        "mode",
        "country",
        "zip"
      ]
    }
  }
]
*/
//mcp-marker:4544aa50fca659b20dd8ae5665a50a0cc8922102
