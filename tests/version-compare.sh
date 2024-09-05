#!/bin/bash
# Copyright (c) 2024 System233
# 
# This software is released under the MIT License.
# https://opensource.org/licenses/MIT

while read file;do 
    (cat $file|grep "//"  | while read x y z _;
    do 
        if dpkg --compare-versions $x $y $z;then 
            r='true'
        else 
            r='false'
        fi
        echo  $x $y $z // $r
        done
    ) > ../$file
done <<<`ls`